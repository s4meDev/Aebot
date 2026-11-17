"""Avalio fatos rastreáveis. A rede neural relaciona linguagem; o JSON decide."""
from __future__ import annotations
import time
from dataclasses import asdict, replace
from typing import Protocol
from .contracts import Evaluation, Match, Source
from .store import RuleStore
from .facts import FactIndex, CaseFacts
from .extraction import Extractor
from .response import format_response


class PairScorer(Protocol):
    calls: int
    def score(self, pairs: list[tuple[str, str]]) -> list[float]: ...


class Engine:
    def __init__(self, store: RuleStore, scorer: PairScorer | None = None):
        self.store, self.scorer = store, scorer
        self.text = store.text
        self.extractors: dict[str, Extractor] = {}

    def validate_request(self, query: str, service_id: str) -> Evaluation | None:
        """Recuso entradas inválidas antes de alterar um caso ou consultar a IA."""
        started = time.perf_counter()
        result = Evaluation(service_id if isinstance(service_id, str) else '', self.store.version, '', 'report')
        service = self.store.services.get(service_id) if isinstance(service_id, str) else None
        if not service or service.get('analysisStatus') == 'rules_pending':
            result.errorCode = 'SERVICE_NOT_FOUND' if not service else 'RULES_PENDING'
            result.reasoningSummary = 'Serviço não encontrado.' if not service else 'As regras deste serviço ainda não foram cadastradas.'
        elif not isinstance(query, str) or not query.strip() or len(query) > 8000:
            result.errorCode = 'INVALID_QUERY'
            result.reasoningSummary = 'Escreva um relato de até 8.000 caracteres, sem dados pessoais.'
        else:
            return None
        return self._finish(result, started)

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

    def evaluate(self, query: str, service_id: str, messages=None, *, intent: str | None = None,
                 ignored_sources: set[tuple[int, str, str]] | None = None, consultation: bool = False) -> Evaluation:
        started = time.perf_counter()
        invalid = self.validate_request(query, service_id)
        if invalid:
            return invalid
        result = Evaluation(service_id, self.store.version, self.text.normalize(query), intent or self.text.intent(query))
        service = self.store.services.get(service_id)
        if service_id not in self.extractors:
            self.extractors[service_id] = Extractor(FactIndex(self.store, service_id), self.scorer)
        extractor = self.extractors[service_id]
        index = extractor.index
        if result.intent == 'question' and (consultation or self.text.general_question(query)):
            return self._consult(query, result, extractor, started)
        state = CaseFacts(self.store)
        rules = self.store.for_service(service_id)
        matches = {}
        calls_before = self.scorer.calls if self.scorer else 0
        try:
            # Cada mensagem mantém sua ordem e o escopo da pergunta pendente.
            # Não transformo os fatos em um prompt que possa mudar o serviço.
            for message_index, (message, scope_hint) in enumerate(messages or [(query, None)]):
                sources = [replace(source, scope_hint=scope_hint, message_index=message_index) for source in self.text.sources(message)]
                sources = [source for source in sources if (message_index, state.scope_of(source), source.quote) not in (ignored_sources or set())]
                # Uma citação descartada não continua como antecedente oculto.
                sources = [replace(source, inherited_from=None, relationship=None)
                    if source.inherited_from and (message_index, state.scope_of(source), source.inherited_from) in (ignored_sources or set())
                    else source for source in sources]
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
        active_query = '. '.join(source.quote for source in state.sources)

        # Aprovação exige declaração completa; nunca é sugerida pela rede.
        for rule in rules:
            if rule.get("severity") == "Conforme" and self.store.constraints(active_query, rule):
                terms = self.text.found(active_query, self._expressions(rule))
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
        self._aggregate(active_query, rules, matches)
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
        elif not state.unresolved and any(not item.active for item in state.observations.values()):
            # Reconhecer que uma falta foi negada é diferente de não achar
            # regra. Isso não aprova o restante da OS nem cria uma ocorrência.
            result.outcome = 'advisory'
            result.reasoningSummary = 'Entendi: esse ponto não está descrito como uma falha. Para recomendar a conclusão da OS, preciso conferir os demais critérios.'
        else:
            result.outcome = "advisory" if ordered else "insufficient"
            result.reasoningSummary = "Reconheci parte do relato, mas falta confirmar outro ponto antes de concluir." if ordered else "Não encontrei regra suficiente para recomendar uma conclusão."
            if ordered:
                # Posso orientar o ponto já sustentado sem fingir que o
                # restante do relato foi resolvido ou fechar a OS inteira.
                result.primaryRule = ordered[0].id
                result.reasoningSummary = ordered[0].message + ' Ainda falta esclarecer outro ponto antes de concluir a OS.'
            if state.unresolved:
                source = state.unresolved[0]
                result.pendingClarification = {'sourceQuote': source.quote, 'scope': state.scope_of(source),
                    'messageIndex': source.message_index if source.message_index is not None else 0}
                local_context = any(state.context(item['id'], state.scope_of(source), source)
                    for item in state.config.get('contexts', []) if item.get('perStatement'))
                record_terms = state.config.get('recordTerms', [])
                if local_context and self.text.polarity(source.model_text) == 'absence' and not self.text.found(source.model_text, record_terms):
                    result.pendingInformation = ['Sobre “' + source.quote[:180] + '”: falta o registro dessa etapa ou a atividade não foi executada? Pode esclarecer com “quis dizer…”.']
                else:
                    result.pendingInformation = ['Pode explicar só este ponto: “' + source.quote[:180] + '”? Se estiver corrigindo o relato, pode começar com “quis dizer…”.']
        if result.activeScope is None:
            active = [item for item in state.observations.values() if item.active]
            result.activeScope = active[-1].scope if active else state.default_scope
        supported = result.scenarioDecision is not None
        result.confidence = ("média" if result.semanticApplied else "alta") if supported else "baixa" if ordered else "insuficiente"
        return self._finish(result, started)

    def _consult(self, query, result, extractor, started):
        """Explico caminhos condicionais da base, sem classificar uma OS."""
        config = self.store.data.get('interpretation', {})
        scope_labels = {item['id']: item['expressions'][0] for item in config.get('scopes', [])}
        explicit = [item['id'] for item in config.get('scopes', []) if self.text.found(query, item['expressions'])]
        scopes = explicit or [config.get('defaultScope', 'default')]
        definitions = {item['id']: item for item in config.get('contexts', [])}
        alternatives = {item['id'] for item in definitions.values()
            if sum(bool(self.text.found(query, value['expressions'])) for value in item['values']) > 1}
        state, selected = CaseFacts(self.store), {}
        unresolved_topics = []
        calls_before = self.scorer.calls if self.scorer else 0
        for scope in scopes:
            source = Source(query, query)
            state.read_context(source, scope)
            groups = extractor.index.candidates(scope)
            try:
                choices, unresolved = extractor.consultation_groups(query, groups, scope)
                unresolved_topics.extend(unresolved)
            except Exception:
                return self._semantic_failure(result, {}, started)
            result.semanticApplied = result.semanticApplied or bool(self.scorer and self.scorer.calls > calls_before)
            for rule in [rule for group in choices for rule in group.rules]:
                meta = rule.get('evaluation', {})
                if meta.get('ask') or rule.get('severity') == 'Conforme':
                    continue
                # Na consulta, uma condição desconhecida vira um caminho
                # explícito. Se foi informada, elimino os caminhos incompatíveis.
                if any(key not in alternatives and state.context(key, scope) and state.context(key, scope).value not in values
                    for key, values in meta.get('requires', {}).items()):
                    continue
                selected[rule['id']] = rule
        multiple_subjects = len({rule.get('evaluation', {}).get('fact', rule.get('factGroup', rule['id'])) for rule in selected.values()}) > 1
        for rule in selected.values():
            meta = rule.get('evaluation', {})
            conditions = [scope_labels[meta['scope']]] if meta.get('scope') in scope_labels else []
            for dimension, values in meta.get('requires', {}).items():
                conditions.append(' ou '.join(item['label'] for item in definitions[dimension]['values'] if item['id'] in values))
            prefix = ', '.join(conditions) or 'Quando o cenário da regra for confirmado'
            if multiple_subjects:
                prefix = rule['title'] + ' — ' + prefix
            explanation = rule.get('guidance', rule['message']) if meta or rule.get('severity') else rule['message']
            result.guidanceOptions.append(prefix + ': ' + explanation)
            match = self._match(rule, query, [], .5)
            match.reasons = ['consulta ao critério; não confirma ocorrência nem classifica uma OS']
            result.matchedRules.append(match)
        result.outcome = 'informational' if selected else 'insufficient'
        result.requiresHumanValidation = not bool(selected)
        result.primaryRule = next(iter(selected), None)
        result.inferenceCalls = (self.scorer.calls - calls_before) if self.scorer else 0
        result.reasoningSummary = 'Orientações condicionais das regras consultadas.' if selected else 'Não encontrei regra suficiente para explicar essa situação.'
        if not selected:
            result.pendingInformation = ['Qual etapa, evidência ou correção da OS você quer esclarecer?']
        elif unresolved_topics:
            result.outcome, result.requiresHumanValidation = 'advisory', True
            result.pendingInformation = ['Expliquei os assuntos encontrados na base. Pode esclarecer este outro ponto: “' + unresolved_topics[0][:180] + '”?']
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
        for match in result.matchedRules:
            match.application = 'consultation' if result.intent == 'question' else 'scenario' if result.intent == 'hypothesis' else 'fact'
        result.durationMs = round((time.perf_counter() - started) * 1000, 2)
        result.content = format_response(result)
        return result

    def _semantic_failure(self, result: Evaluation, matches: dict[str, Match], started: float) -> Evaluation:
        result.errorCode = 'SEMANTIC_FAILURE'
        result.matchedRules = list(matches.values())
        result.reasoningSummary = 'Não consegui interpretar este trecho com a IA local. Tente dividi-lo em mensagens menores; nenhuma conclusão foi emitida.'
        if matches:
            messages = list(dict.fromkeys(item.message for item in matches.values()))
            result.reasoningSummary += '\n\nSobre os pontos já fundamentados: ' + ' '.join(messages[:2]) + ' Isso não fecha a OS; o outro trecho ainda precisa ser esclarecido.'
        return self._finish(result, started)
