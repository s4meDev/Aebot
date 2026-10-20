"""Avalio fatos rastreáveis. A rede neural relaciona linguagem; o JSON decide."""
from __future__ import annotations
import time
from dataclasses import asdict, replace
from typing import Protocol
from .contracts import Evaluation, Match
from .store import RuleStore
from .facts import FactIndex, CaseFacts
from .extraction import Extractor


class PairScorer(Protocol):
    calls: int
    def score(self, pairs: list[tuple[str, str]]) -> list[float]: ...


class Engine:
    def __init__(self, store: RuleStore, scorer: PairScorer | None = None):
        self.store, self.scorer = store, scorer
        self.text = store.text
        self.extractors: dict[str, Extractor] = {}

    def _match(self, rule: dict, quote: str, terms: list[str], score: float = 1.0, semantic: bool = False) -> Match:
        return Match(rule["id"], rule["title"], rule.get("severity"), rule["priority"], quote, score,
            ["significado relacionado pelo modelo local" if semantic else "fato encontrado nas expressões cadastradas"],
            rule.get("factGroup"), rule.get("guidance", ""), rule["message"], rule.get("missingInformation", []),
            matchedTerms=terms)

    def _aggregate(self, query, rules, matches):
        for rule in rules:
            policy = rule.get("matchPolicy", {}).get("minimumMatchedFactGroups")
            if not policy or not self.store.constraints(query, rule):
                continue
            support = {match.factGroup: match for match in matches.values()
                if match.severity and match.factGroup in policy["groups"]}
            if len(support) >= policy["count"]:
                match = self._match(rule, " | ".join(item.sourceQuote for item in support.values()),
                    [term for item in support.values() for term in item.matchedTerms])
                match.supportingRuleIds = [item.id for item in support.values()]
                match.reasons = [f"{len(support)} grupos de fatos independentes confirmados"]
                matches[rule["id"]] = match

    def evaluate(self, query: str, service_id: str, messages=None) -> Evaluation:
        started = time.perf_counter()
        result = Evaluation(service_id, self.store.version, self.text.normalize(query), self.text.intent(query))
        service = self.store.services.get(service_id)
        if not service or service.get("analysisStatus") == "rules_pending":
            result.errorCode = "SERVICE_NOT_FOUND" if not service else "RULES_PENDING"
            result.reasoningSummary = "Serviço não encontrado." if not service else "As regras deste serviço ainda não foram cadastradas."
            return self._finish(result, started)
        if not query.strip() or len(query) > 8000:
            result.errorCode = "INVALID_QUERY"
            result.reasoningSummary = "Escreva um relato de até 8.000 caracteres, sem dados pessoais."
            return self._finish(result, started)
        if service_id not in self.extractors:
            self.extractors[service_id] = Extractor(FactIndex(self.store, service_id), self.scorer)
        extractor = self.extractors[service_id]
        index = extractor.index
        state = CaseFacts(self.store)
        rules = self.store.for_service(service_id)
        matches = {}
        calls_before = self.scorer.calls if self.scorer else 0
        try:
            # Cada mensagem mantém sua ordem e o escopo da pergunta pendente.
            # Não transformo os fatos em um prompt que possa mudar o serviço.
            for message, scope_hint in messages or [(query, None)]:
                sources = [replace(source, scope_hint=scope_hint) for source in self.text.sources(message)]
                extractor.extract(state, sources, result.intent)
        except Exception:
            self._apply_observations(state, index, matches)
            return self._semantic_failure(result, matches, started)
        self._apply_observations(state, index, matches)
        result.observations = [asdict(item) for item in state.observations.values()]
        result.contextFacts = [asdict(item) for item in state.contexts.values()]
        result.contextFacts.extend(asdict(item) for item in state.statement_contexts.values())
        result.inferenceCalls = (self.scorer.calls - calls_before) if self.scorer else 0
        result.semanticApplied = any(item.semantic and item.active for item in state.observations.values())

        # Aprovação exige declaração completa; nunca é sugerida pela rede.
        for rule in rules:
            if rule.get("severity") == "Conforme" and self.store.constraints(query, rule):
                terms = self.text.found(query, self._expressions(rule))
                if terms and not any(self.text.denied(source.model_text) for source in state.sources):
                    matches[rule["id"]] = self._match(rule, query, terms)
        if any(match.severity and match.severity != "Conforme" for match in matches.values()):
            matches = {key: match for key, match in matches.items() if match.severity != "Conforme"}
        if result.intent == "question" and not matches:
            candidates = index.candidates(state.default_scope)
            ranked = sorted(candidates, key=lambda group: extractor.topic_rank(query, group), reverse=True)
            if ranked and extractor.topic(query, ranked[0]) > 0:
                group = ranked[0]
                for rule in group.rules:
                    if rule.get("severity") == "Conforme" or not state.requirements(rule, state.default_scope):
                        continue
                    matches[rule["id"]] = self._match(rule, query, [], .5)
        self._aggregate(query, rules, matches)
        severities = {item["severity"]: item["priority"] for item in self.store.data["conclusions"].values()}
        def rank(match):
            specificity = len(self.text.tokens(" ".join(match.matchedTerms)))
            if service.get("decisionPolicy") == "most_severe_applicable":
                return (severities.get(match.severity, 99), -specificity, match.priority, match.id)
            return (-specificity, -match.score, match.priority, severities.get(match.severity, 99), match.id)
        ordered = sorted(matches.values(), key=rank)
        result.matchedRules = ordered
        classified = [match for match in ordered if match.severity]
        guidance = [match for match in ordered if not match.severity]
        pending = []
        for match in guidance:
            rule = next(rule for rule in rules if rule["id"] == match.id)
            meta = rule.get("evaluation", {})
            dimension = meta.get("ask")
            scope = meta.get("scope", state.default_scope)
            if dimension and state.context(dimension, scope) is None:
                pending.append((match, dimension, scope))
        if pending:
            primary, dimension, scope = pending[0]
            result.outcome, result.primaryRule = "advisory", primary.id
            result.reasoningSummary = primary.message
            result.pendingInformation = [state.question(dimension)]
            result.pendingContext = {"dimension": dimension, "scope": scope}
            result.activeScope = scope
        elif result.intent == "question":
            result.outcome, result.requiresHumanValidation = "informational", False
            if ordered:
                primary = ordered[0]
                result.primaryRule = primary.id
                result.reasoningSummary = (f"A regra prevê {primary.severity} quando esse cenário é confirmado. " if primary.severity else "") + primary.message
            else:
                result.reasoningSummary = service["summary"] + " " + " ".join(service.get("insights", [])[:2])
        elif classified and not state.unresolved:
            primary = classified[0]
            result.primaryRule = primary.id
            result.scenarioDecision = primary.severity
            result.decision = primary.severity if result.intent != "hypothesis" else None
            result.outcome = "decision" if result.decision else "informational"
            result.hasSufficientEvidence = bool(result.decision)
            result.requiresHumanValidation = False
            result.reasoningSummary = primary.message
            if len({item.severity for item in classified}) > 1:
                result.conflicts = [{"ruleIds": [item.id for item in classified], "winnerRuleId": primary.id,
                    "resolution": "Ordem de aplicabilidade e gravidade definida no serviço."}]
        elif guidance and not state.unresolved:
            primary = guidance[0]
            result.outcome, result.primaryRule = "advisory", primary.id
            result.reasoningSummary = primary.message
        else:
            result.outcome = "advisory" if ordered else "insufficient"
            result.reasoningSummary = "Reconheci parte do relato, mas falta confirmar outro ponto antes de concluir." if ordered else "Não encontrei regra suficiente para recomendar uma conclusão."
            if state.unresolved:
                result.pendingInformation = ["Pode detalhar qual evidência ou correção está faltando nesse ponto?"]
        if result.activeScope is None:
            active = [item for item in state.observations.values() if item.active]
            result.activeScope = active[-1].scope if active else state.default_scope
        supported = result.scenarioDecision is not None
        result.confidence = ("média" if result.semanticApplied else "alta") if supported else "baixa" if ordered else "insuficiente"
        return self._finish(result, started)

    def _expressions(self, rule):
        return rule.get("conditionKeywords", []) + rule.get("equivalentExpressions", [])

    def _apply_observations(self, state, index, matches):
        for observation in state.observations.values():
            if not observation.active:
                continue
            group = index.groups.get((observation.scope, observation.fact)) or index.groups.get(("*", observation.fact))
            if not group:
                continue
            for rule in group.rules:
                meta = rule.get("evaluation", {})
                if not state.requirements(rule, observation.scope, observation.source):
                    continue
                if meta.get("ask") and state.context(meta["ask"], observation.scope):
                    continue
                issue = state.constraint_issue(rule, observation.scope, observation.source)
                if issue:
                    if issue == 'missing' and rule.get('evaluation') and observation.source not in state.unresolved:
                        state.unresolved.append(observation.source)
                    continue
                match = self._match(rule, observation.source.quote,
                    list(observation.terms), observation.score, observation.semantic)
                if observation.source.inherited_from:
                    match.contextQuotes = [observation.source.inherited_from]
                matches[rule['id']] = match

    def _finish(self, result: Evaluation, started: float) -> Evaluation:
        result.durationMs = round((time.perf_counter() - started) * 1000, 2)
        result.content = format_response(result)
        return result

    def _semantic_failure(self, result: Evaluation, matches: dict[str, Match], started: float) -> Evaluation:
        result.errorCode = 'SEMANTIC_FAILURE'
        result.matchedRules = list(matches.values())
        result.reasoningSummary = 'Não consegui interpretar este trecho com a IA local. Tente dividi-lo em mensagens menores; nenhuma conclusão foi emitida.'
        return self._finish(result, started)


def format_response(result: Evaluation) -> str:
    if result.errorCode:
        return result.reasoningSummary
    if result.decision:
        primary = next(item for item in result.matchedRules if item.id == result.primaryRule)
        answer = f"Minha recomendação é {result.decision}. {primary.message}"
        if primary.guidance and primary.guidance != primary.message:
            answer += "\n\n" + primary.guidance
    elif result.intent == "hypothesis" and result.scenarioDecision:
        answer = f"Nesse cenário, a regra prevê {result.scenarioDecision}. {result.reasoningSummary}"
    else:
        answer = result.reasoningSummary
    if result.pendingInformation:
        answer += "\n\n" + result.pendingInformation[0]
    elif not result.decision and result.outcome == "insufficient":
        answer += " Valide com o responsável ou descreva melhor o que foi observado na OS."
    if result.matchedRules:
        answer += "\n\nBase: " + "; ".join(f"{item.id} — {item.title}" for item in result.matchedRules[:4]) + "."
    return answer
