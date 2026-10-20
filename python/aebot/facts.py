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
            return matches[-1] if matches else None
        return self.contexts.get((dimension, scope)) or self.contexts.get((dimension, '*'))

    def read_context(self, source, scope):
        normalized = self.text.normalize(source.model_text)
        found_any = False
        for definition in self.config.get('contexts', []):
            found = []
            for value in definition['values']:
                for expression in value['expressions']:
                    wanted = self.text.normalize(expression)
                    for match in re.finditer(r'\b' + re.escape(wanted) + r'\b', normalized):
                        if re.search(r'nao (?:(?:e|era|foi|esta|estava|fica|ficou) )?$', normalized[max(0, match.start() - 16):match.start()]):
                            continue
                        found.append((match.start(), len(wanted), value))
                # Contexto admite palavras intermediárias, mas não atravessa
                # outra negação. O valor mais completo desempata a expressão.
                for expression in value['expressions']:
                    if self.text.flexible(source.model_text, expression, context=True) and not re.search(
                        r'\bnao (?:e|era|foi) ' + re.escape(self.text.normalize(expression)), normalized):
                        found.append((0, len(expression), value))
            if found and not self.text.uncertain(source.model_text):
                if definition.get('perStatement'):
                    values = {item[2]['id'] for item in found}
                    # Mais de uma etapa na mesma oração é ambígua; não escolho
                    # a última palavra e não propago a etapa para o caso todo.
                    if len(values) == 1:
                        value = found[0][2]
                        self.statement_contexts[(definition['id'], scope, source)] = ContextFact(definition['id'], value['id'], scope, source.quote)
                    continue
                value = max(found, key=lambda item: (item[0], item[1]))[2]
                explicit_scope = any(self.text.found(source.model_text, item['expressions']) for item in self.config.get('scopes', []))
                bound_scope = scope if explicit_scope or source.scope_hint else '*'
                fact = ContextFact(definition['id'], value['id'], bound_scope, source.quote)
                self.contexts.pop((definition['id'], bound_scope), None)
                self.contexts[(definition['id'], bound_scope)] = fact
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
