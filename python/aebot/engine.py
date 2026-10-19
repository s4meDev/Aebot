"""Avalio fatos rastreáveis. A rede neural relaciona linguagem; o JSON decide."""
from __future__ import annotations
import re
import time
from typing import Protocol
from .contracts import Evaluation, Match, Source
from .store import RuleStore


class PairScorer(Protocol):
    calls: int
    def score(self, pairs: list[tuple[str, str]]) -> list[float]: ...


class Engine:
    def __init__(self, store: RuleStore, scorer: PairScorer | None = None):
        self.store, self.scorer = store, scorer
        self.text = store.text

    def _match(self, rule: dict, quote: str, terms: list[str], score: float = 1.0, semantic: bool = False) -> Match:
        return Match(rule["id"], rule["title"], rule.get("severity"), rule["priority"], quote, score,
            ["significado relacionado pelo modelo local" if semantic else "fato encontrado nas expressões cadastradas"],
            rule.get("factGroup"), rule.get("guidance", ""), rule["message"], rule.get("missingInformation", []),
            matchedTerms=terms)

    def _expressions(self, rule: dict) -> list[str]:
        return rule.get("conditionKeywords", []) + rule.get("equivalentExpressions", [])

    def _rule_absence(self, rule: dict) -> bool:
        criterion = self.store.criteria(rule)[0]
        return self.text.polarity(criterion) == "absence"

    def _lexical(self, query: str, rule: dict, sources: list[Source], intent: str) -> tuple[Match | None, bool]:
        if not self.store.constraints(query, rule):
            return None, False
        if rule.get("matchPolicy", {}).get("minimumMatchedFactGroups"):
            return None, False
        active, present = None, False
        for source in sources:
            terms = self.text.found(source.model_text, self._expressions(rule))
            polarity = self.text.polarity(source.model_text)
            evidence = self.text.found(source.model_text, rule.get("relatedEvidence"))
            cancelled = self.text.found(source.model_text, rule.get("negativeSignals"))
            if self._rule_absence(rule) and (cancelled or (evidence and polarity == "present")):
                active, present = None, True
                continue
            if terms and not cancelled:
                active, present = self._match(rule, source.quote, terms), False
                continue
            signals = self.text.found(source.model_text, rule.get("positiveSignals"))
            if evidence and signals and polarity != "present":
                active, present = self._match(rule, source.quote, evidence + signals), False
            passive = self.text.missing_subject(source.model_text, rule.get('relatedEvidence'))
            if self._rule_absence(rule) and passive:
                active, present = self._match(rule, source.quote, passive), False
        # Regras compostas exigem os fatos/contextos do relato inteiro, não uma
        # semelhança do modelo nem uma palavra solta da pergunta.
        policy = rule.get("matchPolicy", {})
        groups = policy.get("minimumGroups")
        all_of = policy.get("allOf", [])
        group_terms = [term for group in (groups or {}).get("groups", [])
            for term in self.text.found(query, group["expressions"])]
        enough_groups = groups and sum(bool(self.text.found(query, group["expressions"]))
            for group in groups["groups"]) >= groups["count"]
        full_terms = self.text.found(query, self._expressions(rule))
        if enough_groups or (all_of and all(self.text.has(query, term) for term in all_of)):
            active = self._match(rule, query, group_terms + all_of)
        elif full_terms and not self.text.found(query, rule.get("negativeSignals")) and not present:
            active = active or self._match(rule, query, full_terms)
        return active, present

    def _aggregate(self, query: str, rules: list[dict], matches: dict[str, Match]) -> None:
        for rule in rules:
            policy = rule.get("matchPolicy", {}).get("minimumMatchedFactGroups")
            if not policy or not self.store.constraints(query, rule):
                continue
            support = {match.factGroup: match for match in matches.values()
                if match.severity and match.factGroup in policy["groups"]}
            if len(support) >= policy["count"]:
                matched = self._match(rule, " | ".join(item.sourceQuote for item in support.values()),
                    [term for item in support.values() for term in item.matchedTerms])
                matched.reasons = [f"{len(support)} grupos de fatos independentes confirmados"]
                matched.supportingRuleIds = [item.id for item in support.values()]
                matches[rule["id"]] = matched

    def evaluate(self, query: str, service_id: str) -> Evaluation:
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
        rules = self.store.for_service(service_id)
        sources = self.text.sources(query)
        matches: dict[str, Match] = {}
        negated: set[str] = set()
        for rule in rules:
            match, present = self._lexical(query, rule, sources, result.intent)
            if present:
                negated.add(rule["id"])
            if match:
                matches[rule["id"]] = match
        consumed = set()
        for match in matches.values():
            consumed.update(self.text.tokens(" ".join(match.matchedTerms)))
            rule = next(rule for rule in rules if rule["id"] == match.id)
            for group in rule.get("mandatoryConditionGroups", []):
                consumed.update(self.text.tokens(" ".join(self.text.found(query, group["expressions"]))))
        harmless = {"e", "nem", "nao", "sim", "esta", "estao", "foi", "informacao", "solicitada", "eu",
            "reprovado", "conforme", "aprovar", "devo", "posso"}
        unresolved: list[Source] = []
        for source in sources:
            tokens = set(self.text.tokens(source.model_text)) - harmless
            covered = any(match.sourceQuote == source.quote
                for match in matches.values())
            covered = covered or any(rule.get('matchPolicy', {}).get('minimumGroups') and
                self.text.found(source.model_text, [term for group in rule['matchPolicy']['minimumGroups']['groups'] for term in group['expressions']])
                for rule in rules if rule['id'] in matches)
            # Uma declaração global de conferência não acrescenta uma falha.
            # Se houver falha específica, ela continua prevalecendo.
            covered = covered or any(rule.get('severity') == 'Conforme' and
                self.text.found(source.model_text, [term for group in rule.get('mandatoryConditionGroups', []) for term in group['expressions']])
                for rule in rules)
            if tokens and not tokens.issubset(consumed) and not covered:
                unresolved.append(source)
        # Informação presente isolada não vira irregularidade. Em consulta,
        # recupero o tema para explicar a regra sem classificar uma OS real.
        if result.intent == "question":
            if not matches:
                ranked = [(max((len(self.text.tokens(term)) for term in self.text.found(query, rule.get("relatedEvidence", []) + rule.get("topicKeywords", []))), default=0), rule)
                    for rule in rules if self.store.constraints(query, rule)]
                ranked.sort(key=lambda item: (item[0], not item[1].get('appliesToAllActiveServices'), -item[1]['priority']), reverse=True)
                if ranked and ranked[0][0]:
                    rule = ranked[0][1]
                    matches[rule["id"]] = self._match(rule, query, [], 0.5)
            unresolved = [] if matches else unresolved
        calls_before = self.scorer.calls if self.scorer else 0
        unconfirmed = []
        if unresolved and self.scorer:
            # Aprovação depende de conferência explícita, nunca de semelhança.
            atomic = [rule for rule in rules if rule.get("severity") != "Conforme"
                and not rule.get("matchPolicy", {}).get("minimumMatchedFactGroups")
                and rule["id"] not in negated and self.store.constraints(query, rule)]
            cards = [(rule, criterion) for rule in atomic for criterion in self.store.criteria(rule)]
            for source in unresolved:
                polarity = self.text.polarity(source.model_text)
                # Não pontuo mera presença ou consulta como uma falta.
                if result.intent == "report" and polarity == "present":
                    continue
                explicit = [card for card in cards if card[0].get('semanticCriteria')]
                first = explicit or cards
                try:
                    scores = self.scorer.score([(source.model_text, criterion) for _, criterion in first])
                except Exception:
                    return self._semantic_failure(result, matches, started)
                ranked = sorted(zip(first, scores), key=lambda item: item[1], reverse=True)
                if explicit and (not ranked or ranked[0][1] < 0):
                    rest = [card for card in cards if not card[0].get('semanticCriteria')]
                    try:
                        scores = self.scorer.score([(source.model_text, criterion) for _, criterion in rest])
                    except Exception:
                        return self._semantic_failure(result, matches, started)
                    ranked = sorted(ranked + list(zip(rest, scores)), key=lambda item: item[1], reverse=True)
                if not ranked:
                    unconfirmed.append(source)
                    continue
                (rule, criterion), score = ranked[0]
                runner = next((other for (card, other) in ranked[1:] if card[0]["id"] != rule["id"]), -100)
                # Valores são logits de relevância, não porcentagens de acerto.
                # O critério precisa estar destacado e sustentar a ocorrência.
                compatible = (self._rule_absence(rule) == (polarity == "absence")) or result.intent != "report"
                if score >= 0 and score - runner >= 0.25 and compatible:
                    matches[rule["id"]] = self._match(rule, source.quote, [criterion], score, True)
                    result.semanticApplied = True
                elif polarity == "absence" or matches:
                    unconfirmed.append(source)
        elif unresolved:
            unconfirmed = [source for source in unresolved if self.text.polarity(source.model_text) != "present"]
        result.inferenceCalls = (self.scorer.calls - calls_before) if self.scorer else 0
        self._aggregate(query, rules, matches)
        severities = {value["severity"]: value["priority"] for value in self.store.data["conclusions"].values()}
        ordered = sorted(matches.values(), key=lambda match: (severities.get(match.severity, 99),
            -len(self.text.tokens(" ".join(match.matchedTerms))), match.priority, match.id))
        result.matchedRules = ordered
        classified = [item for item in ordered if item.severity]
        guidance = [item for item in ordered if not item.severity]
        if result.intent == "question":
            result.outcome, result.requiresHumanValidation = "informational", False
            if ordered:
                primary = ordered[0]
                result.primaryRule = primary.id
                result.reasoningSummary = (f"A regra prevê {primary.severity} quando esse cenário é confirmado. " if primary.severity else "") + primary.message
                result.pendingInformation = primary.missingInformation[:1]
            else:
                result.reasoningSummary = service["summary"] + " " + " ".join(service.get("insights", [])[:2])
        elif classified and not unconfirmed:
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
                    "resolution": "Prevaleceu a conclusão mais grave entre regras realmente aplicáveis."}]
        elif guidance:
            primary = sorted(guidance, key=lambda item: (-len(self.text.tokens(" ".join(item.matchedTerms))), item.priority))[0]
            result.outcome, result.primaryRule = "advisory", primary.id
            result.reasoningSummary = primary.message
            result.pendingInformation = primary.missingInformation[:1]
        else:
            result.outcome = "advisory" if classified else "insufficient"
            result.reasoningSummary = "Reconheci parte do relato, mas falta confirmar outro ponto antes de concluir." if classified else "Não encontrei regra suficiente para recomendar uma conclusão."
            if unconfirmed:
                result.pendingInformation = ["Pode detalhar qual evidência ou correção está faltando nesse ponto?"]
        supported = result.decision is not None or result.scenarioDecision is not None
        result.confidence = ("média" if result.semanticApplied else "alta") if supported else "baixa" if ordered else "insuficiente"
        return self._finish(result, started)

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
