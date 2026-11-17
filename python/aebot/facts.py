"""Separo o que ocorreu, onde ocorreu e quais informações mudam a regra."""
from dataclasses import dataclass, field
import re
from .contracts import Source, ContextFact, Observation


@dataclass
class FactGroup:
    key: str
    scope: str
    stance: str
    rules: list[dict] = field(default_factory=list)


class FactIndex:
    def __init__(self, store, service_id):
        self.store = store
        self.service_name = store.services[service_id]['name']
        self.groups: dict[tuple[str, str], FactGroup] = {}
        for rule in store.for_service(service_id):
            if rule.get('matchPolicy', {}).get('minimumMatchedFactGroups'):
                continue
            meta = rule.get('evaluation', {})
            key = meta.get('fact', rule.get('factGroup', rule['id']))
            scope = meta.get('scope', '*')
            stance = meta.get('stance', 'absence' if store.text.polarity(store.criteria(rule)[0]) == 'absence' else 'irregularity')
            group = self.groups.setdefault((scope, key), FactGroup(key, scope, stance))
            group.rules.append(rule)

    def candidates(self, scope):
        return [group for group in self.groups.values() if group.scope in ('*', scope)]

    def expressions(self, group):
        return list(dict.fromkeys(term for rule in group.rules for term in
            rule.get('conditionKeywords', []) + rule.get('equivalentExpressions', [])))

    def evidence(self, group):
        return list(dict.fromkeys(term for rule in group.rules for term in rule.get('relatedEvidence', [])))

    def criteria(self, group):
        # Interpreto uma situação uma vez, não uma vez por conclusão/equipe.
        explicit = [criterion for rule in group.rules for criterion in rule.get('semanticCriteria', [])]
        return explicit[0] if explicit else self.store.criteria(group.rules[0])[0]


class CaseFacts:
    def __init__(self, store):
        self.store = store
        self.text = store.text
        self.config = store.data.get('interpretation', {})
        self.default_scope = self.config.get('defaultScope', 'default')
        self.contexts: dict[tuple[str, str], ContextFact] = {}
        self.context_sources: dict[tuple[str, str], Source] = {}
        self.statement_contexts = {}
        self.observations: dict[tuple[str, str], Observation] = {}
        self.unresolved: list[Source] = []
        self.sources: list[Source] = []

    def scope_of(self, source):
        normalized = self.text.normalize(source.model_text)
        found = []
        for scope in self.config.get('scopes', []):
            for expression in scope['expressions']:
                wanted = self.text.normalize(expression)
                for match in re.finditer(r'\b' + re.escape(wanted) + r'\b', normalized):
                    prefix = normalized[max(0, match.start() - 22):match.start()]
                    if not re.search(r'nao (?:sobre |d[aoe] |o |a )?$', prefix):
                        found.append((match.start(), len(wanted), scope['id']))
        return max(found)[2] if found else source.scope_hint or self.default_scope

    def context(self, dimension, scope, source=None):
        definition = next((item for item in self.config.get('contexts', []) if item['id'] == dimension), {})
        if definition.get('perStatement'):
            return self.statement_contexts.get((dimension, scope, source))
        if definition.get('shared'):
            matches = [fact for (key, _), fact in self.contexts.items() if key == dimension]
            actual = matches[-1] if matches else None
        else:
            actual = self.contexts[(dimension, scope)] if (dimension, scope) in self.contexts else self.contexts.get((dimension, '*'))
        # Um valor explicitamente incerto bloqueia o contexto antigo, mas
        # continua citado como incerto no diagnóstico em memória.
        return actual if actual and actual.value is not None else None

    def read_context(self, source, scope):
        normalized = self.text.normalize(source.model_text)
        if self.text.denied(source.model_text):
            return False
        found_any = False
        for definition in self.config.get('contexts', []):
            found = []
            negated = set()
            for value in definition['values']:
                for expression in value['expressions']:
                    wanted = self.text.normalize(expression)
                    exact = list(re.finditer(r'\b' + re.escape(wanted) + r'\b', normalized))
                    for match in exact:
                        if self.text.context_negated(normalized[:match.start()]):
                            negated.add(value['id'])
                            continue
                        found.append((match.start(), len(wanted), value))
                    # Não reinsiro por matching flexível uma expressão exata
                    # que já foi descartada por estar negada.
                    if not exact and self.text.flexible(source.model_text, expression, context=True):
                        found.append((0, len(expression), value))
            if not found and negated and not definition.get('perStatement'):
                previous = self.context(definition['id'], scope)
                if previous and previous.value in negated:
                    # Negar o vínculo antigo não confirma o oposto. Suspendo
                    # somente esse contexto até o analista informar o atual.
                    key = (definition['id'], scope)
                    self.contexts.pop(key, None)
                    self.contexts[key] = ContextFact(definition['id'], None, scope, source.quote)
                    self.context_sources[key] = source
                    found_any = True
            if found and self.text.uncertain(source.model_text) and not definition.get('perStatement'):
                # Se a certeza anterior foi retirada, não continuo usando o
                # vínculo antigo. Sem valor anterior, continuo sem confirmar.
                if self.context(definition['id'], scope):
                    key = (definition['id'], scope)
                    self.contexts.pop(key, None)
                    self.contexts[key] = ContextFact(definition['id'], None, scope, source.quote)
                    self.context_sources[key] = source
                    found_any = True
            if found and not self.text.uncertain(source.model_text):
                if definition.get('perStatement'):
                    values = {item[2]['id'] for item in found}
                    # Mais de uma etapa na mesma oração é ambígua; não escolho
                    # a última palavra e não propago a etapa para o caso todo.
                    if len(values) == 1:
                        value = found[0][2]
                        self.statement_contexts[(definition['id'], scope, source)] = ContextFact(definition['id'], value['id'], scope, source.quote)
                    continue
                explicit_scope = any(self.text.found(source.model_text, item['expressions']) for item in self.config.get('scopes', []))
                bound_scope = scope if explicit_scope or source.scope_hint else '*'
                value_id = max(found, key=lambda item: (item[0], item[1]))[2]['id']
                correction = bool(re.search(r'\b(?:agora|corrigindo|na verdade|quis dizer|quero dizer)\b', normalized))
                explicit_alternatives = bool(re.search(r'\b(?:ou|versus|vs)\b', normalized.replace('/', ' ou '))) or '/' in source.model_text
                alternatives = len({item[2]['id'] for item in found}) > 1 and (explicit_alternatives or not correction)
                previous_key = (definition['id'], bound_scope)
                previous = self.contexts.get(previous_key)
                previous_source = self.context_sources.get(previous_key)
                # Uma enumeração separada por vírgula continua sendo do mesmo
                # turno. Não escolho a última equipe só por ser a última frase.
                if (previous and previous_source and previous_source.message_index == source.message_index
                    and previous.value != value_id and not correction):
                    alternatives = True
                if alternatives:
                    # "Interna e terceirizada" também não confirma um vínculo.
                    # A incerteza vale neste escopo, não apaga a OS de origem.
                    bound_scope = scope
                    value_id = None
                else:
                    previous = self.contexts.get((definition['id'], scope))
                    if bound_scope == '*' and previous and previous.value is None:
                        self.contexts.pop((definition['id'], scope))
                        self.context_sources.pop((definition['id'], scope), None)
                fact = ContextFact(definition['id'], value_id, bound_scope, source.quote)
                self.contexts.pop((definition['id'], bound_scope), None)
                self.contexts[(definition['id'], bound_scope)] = fact
                self.context_sources[(definition['id'], bound_scope)] = source
                found_any = True
        return found_any

    def put(self, group, source, scope, active, terms, score=1.0, semantic=False):
        self.observations[(scope, group.key)] = Observation(group.key, scope, source, active, score, tuple(terms), semantic)

    def requirements(self, rule, scope, source=None):
        for dimension, values in rule.get('evaluation', {}).get('requires', {}).items():
            actual = self.context(dimension, scope, source)
            if actual is None or actual.value not in values:
                return False
        for dimension, values in rule.get('evaluation', {}).get('incompatible', {}).items():
            actual = self.context(dimension, scope, source)
            if actual is not None and actual.value in values:
                return False
        return True

    def question(self, dimension):
        return next((item['question'] for item in self.config.get('contexts', []) if item['id'] == dimension), 'Pode confirmar essa informação?')

    def constraint_issue(self, rule, scope, source):
        """Substituo só o contexto declarado. As outras condições continuam."""
        meta = rule.get('evaluation', {})
        dimensions = set(meta.get('requires', {})) | ({meta['ask']} if meta.get('ask') else set())
        context_terms = {self.text.normalize(expression)
            for context in self.config.get('contexts', []) if context['id'] in dimensions
            for value in context['values'] for expression in value['expressions'] + [value['label']]}
        scope_terms = {self.text.normalize(expression)
            for definition in self.config.get('scopes', []) if definition['id'] == scope
            for expression in definition['expressions']}
        all_scope_terms = {self.text.normalize(expression)
            for definition in self.config.get('scopes', []) for expression in definition['expressions']}
        scoped_text = '. '.join(item.model_text for item in self.sources if self.scope_of(item) == scope
            and not self.text.denied(item.model_text) and not self.text.uncertain(item.model_text))
        for exception in rule.get('exceptions', []):
            # A equipe antiga não pode excepcionar a equipe atual. Presença de
            # evidência é conferida no fato vigente, não na história inteira.
            if meta and self.text.normalize(exception) in context_terms | all_scope_terms:
                continue
            if self.text.has(source.model_text, exception):
                return 'exception'
        if any(not self.text.has(scoped_text, term) for term in rule.get('mandatoryConditions', [])):
            return 'missing'
        for group in rule.get('mandatoryConditionGroups', []):
            expressions = {self.text.normalize(term) for term in group['expressions']}
            if meta and expressions & (context_terms | scope_terms):
                continue
            if not self.text.found(scoped_text, group['expressions']):
                return 'missing'
        return None
