"""Recupero candidatos, mas só fatos afirmados podem sustentar uma decisão."""
import math
import re
from collections import Counter, OrderedDict
from dataclasses import replace
from .contracts import Source

STOP = {'qual', 'quais', 'como', 'regra', 'regras', 'servico', 'preciso', 'sobre', 'devo', 'fazer',
        'essa', 'esse', 'pode', 'quando', 'onde', 'significa', 'explica', 'explique', 'uma', 'que', 'para', 'e', 'ou', 'se', 'nao',
        'me', 'diferenca', 'entre', 'criterio', 'criterios', 'quero', 'gostaria', 'entender'}


class Extractor:
    def __init__(self, index, scorer=None):
        self.index, self.scorer = index, scorer
        self.text = index.store.text
        self.cache = OrderedDict()
        self.vocabulary = {}
        for key, group in index.groups.items():
            words = self.text.tokens(' '.join(rule['title'] + ' ' + ' '.join(rule.get('topicKeywords', []) +
                rule.get('relatedEvidence', []) + rule.get('conditionKeywords', []) + rule.get('semanticCriteria', [])) for rule in group.rules))
            self.vocabulary[key] = set(words) - STOP
        self.frequencies = Counter(word for words in self.vocabulary.values() for word in words)
        self.context_words = {word for context in index.store.data.get('interpretation', {}).get('contexts', []) if not context.get('perStatement')
            for value in context['values'] for expression in value['expressions'] + [value['label']]
            for word in self.text.tokens(expression)}
        self.context_links = set(self.text.tokens('não nem é era eram foi foram sou somos são estou estamos está estão estava estavam apenas só pode ser confirmo corrigindo na verdade'))
        self.context_links.update(word for scope in index.store.data.get('interpretation', {}).get('scopes', [])
            for expression in scope['expressions'] for word in self.text.tokens(expression))
        self.scope_words = {word for scope in index.store.data.get('interpretation', {}).get('scopes', [])
            for expression in scope['expressions'] for word in self.text.tokens(expression)}
        self.context_links.update(self.text.tokens('não sei informar dizer não sabemos não tenho certeza não tenho como confirmar não foi confirmado ainda preciso confirmar conferir verificar acho que acredito que parece que pode ser talvez provavelmente possivelmente'))

    def context_only(self, query):
        words = set(self.text.tokens(query)) - STOP
        return bool(words & self.context_words) and words <= self.context_words | self.context_links

    def topic(self, query, group, *, ignore_service=False, ignore_context=False):
        words = set(self.text.tokens(query)) - STOP
        if ignore_service:
            words -= set(self.text.tokens(self.index.service_name))
        if ignore_context:
            # Equipe/frente são filtros, não um assunto suficiente por si só.
            # "Almoço da equipe" não é uma dúvida sobre falta de aferição.
            words -= self.context_words
        return sum(math.log(1 + len(self.vocabulary) / self.frequencies[word])
            for word in words & self.vocabulary[(group.scope, group.key)])

    def topic_rank(self, query, group):
        # Uma regra genérica com muitos assuntos não deve esconder a regra
        # específica só por compartilhar as mesmas duas palavras da pergunta.
        size = max(1, len(self.vocabulary[(group.scope, group.key)]))
        words = set(self.text.tokens(query)) - STOP
        anchors = [term for rule in group.rules for term in [rule['title']] +
            rule.get('topicKeywords', []) + rule.get('relatedEvidence', []) + rule.get('conditionKeywords', [])]
        overlap = max((len(words & set(self.text.tokens(term))) for term in anchors), default=0)
        return (overlap, not all(rule.get('appliesToAllActiveServices') for rule in group.rules),
            overlap >= 2 and any(rule.get('severity') for rule in group.rules), self.topic(query, group) / math.sqrt(size))

    def consultation_groups(self, query, groups, selected_scope=None):
        """Recupero cada assunto pedido, sem tratar a enumeração como ocorrência."""
        from .facts import CaseFacts
        selected, unresolved = [], []
        record = None
        previous_subject = None
        for part in self.text.consultation_parts(query):
            explicit_scopes = [scope['id'] for scope in self.index.store.data.get('interpretation', {}).get('scopes', [])
                if self.text.found(part, scope['expressions'])]
            words = set(self.text.tokens(part)) - STOP
            scope_only = bool(words & self.scope_words) and words <= self.scope_words | self.context_links
            ranking_query = part
            if scope_only and previous_subject:
                # “Aferição na OS atual e na origem” repete o assunto, não
                # declara que a OS de origem está ausente. Só o ranking lexical
                # retira termos de escopo; a fonte literal continua inteira.
                ranking_query = ' '.join(word for word in self.text.tokens(previous_subject) if word not in self.scope_words)
            elif not self.context_only(part):
                previous_subject = part
            if explicit_scopes and selected_scope and selected_scope not in explicit_scopes:
                continue
            head = self.text.record_match(part)
            if head:
                record = head.group(0)
            elif record and any(self.text.tokens(part) == self.text.tokens(term) for term in self.text.ellipsis_terms):
                # Em “foto antes e depois”, o objeto foi escrito na mesma
                # consulta. Não estendo essa retomada a um assunto novo.
                part = record + ' ' + part
                ranking_query = part
            local = CaseFacts(self.index.store)
            source = Source(part, part)
            scope = local.scope_of(source)
            local.read_context(source, scope)
            eligible = [group for group in groups if any(not any(
                local.context(key, scope, source) and local.context(key, scope, source).value in values
                for key, values in rule.get('evaluation', {}).get('incompatible', {}).items()) for rule in group.rules)]
            lexical = [group for group in eligible if self.topic(ranking_query, group, ignore_service=True, ignore_context=True) > 0]
            best = max(lexical, key=lambda group: self.topic_rank(ranking_query, group), default=None)
            other_ranks = [self.topic_rank(ranking_query, group)[:2] for group in lexical if group is not best]
            distinctive = bool(best and (self.topic_rank(ranking_query, best)[0] >= 2 or
                self.topic_rank(ranking_query, best)[:2] > max(other_ranks, default=(0, False)) or any(
                self.frequencies[word] == 1 for word in (set(self.text.tokens(ranking_query)) - STOP) & self.vocabulary[(best.scope, best.key)]) or
                sum(self.frequencies[word] <= 2 for word in (set(self.text.tokens(ranking_query)) - STOP) & self.vocabulary[(best.scope, best.key)]) >= 2))
            if (best is None or (self.scorer and not distinctive)) and not self.context_only(part) and self.text.tokens(part):
                # “Registro” aparece em vários critérios. Uma palavra genérica
                # não encerra uma consulta que ainda precisa de interpretação.
                semantic = self.semantic(Source(query, self.text.consultation_subject(part)), eligible)
                best = semantic[0] if semantic else None
            if best and best not in selected:
                selected.append(best)
            elif best is None and not self.context_only(part) and set(self.text.tokens(part)) - STOP:
                unresolved.append(part)
        return selected, unresolved

    def evidence_heads(self, group):
        records = self.index.store.data.get('interpretation', {}).get('recordTerms', [])
        local_dimensions = {item['id'] for item in self.index.store.data.get('interpretation', {}).get('contexts', []) if item.get('perStatement')}
        if records and any(set(rule.get('evaluation', {}).get('incompatible', {})) & local_dimensions for rule in group.rules):
            return records
        return list(dict.fromkeys(self.text.tokens(term)[0]
            for term in self.index.evidence(group) if self.text.tokens(term)))

    def eligible(self, group, source, state, scope, intent, inactive):
        if group.key in inactive or any(rule.get('severity') == 'Conforme' for rule in group.rules):
            return False
        if not any(state.requirements(rule, scope, source) for rule in group.rules):
            return False
        if group.stance == 'absence':
            if intent == 'report' and self.text.polarity(source.model_text) != 'absence':
                return False
            heads = self.evidence_heads(group)
            hits = self.text.found(source.model_text, heads)
            # "Sem legenda na foto" não afirma que a foto está ausente.
            if self.text.polarity(source.model_text) == 'absence' and hits and not any(
                self.text.absent_target(source.model_text, head) for head in hits):
                return False
        return intent == 'question' or any(state.constraint_issue(rule, scope, source) != 'missing' for rule in group.rules)

    def contextual(self, group, source, state, scope):
        dimensions = {key for rule in group.rules for key in rule.get('evaluation', {}).get('incompatible', {})}
        local = [state.context(key, scope, source) for key in dimensions]
        if group.stance != 'absence' or not any(local):
            return [], False
        # Combino o objeto e a etapa citada. "Sem registro de como estava no
        # começo" não precisa ser cadastrado inteiro; registro + começo são
        # conceitos da base. Só mencionar uma etapa não comprova ausência.
        hits = self.text.found(source.model_text, self.evidence_heads(group))
        if hits and (self.text.regular(source.model_text) or self.text.polarity(source.model_text) == 'present'):
            return hits, False
        absent = [head for head in hits if self.text.absent_target(source.model_text, head)]
        if absent:
            return absent, True
        return [], False

    def lexical(self, group, source, scope_text):
        terms = [term for term in self.index.expressions(group) if self.text.flexible(source.model_text, term)]
        evidence = self.text.found(source.model_text, self.index.evidence(group))
        cancelled = [term for rule in group.rules for term in self.text.found(source.model_text, rule.get('negativeSignals'))]
        cancelled += [term for rule in group.rules for term in self.text.found(source.model_text, rule.get('exceptions'))
            if self.text.polarity(term) == 'present' and self.text.polarity(source.model_text) == 'present']
        if cancelled:
            return cancelled, False
        if self.text.denied(source.model_text):
            return (terms or evidence), False
        if group.stance == 'absence':
            if terms:
                return terms, self.text.polarity(source.model_text) == 'absence'
            absent = [term for term in evidence if self.text.absent_target(source.model_text, term)]
            if absent:
                return absent, True
            # Os grupos de contexto não são fatos; uso aqui só os predicados
            # de ausência já cadastrados nas regras que compartilham o fato.
            patterns = [term for rule in group.rules
                for part in rule.get('matchPolicy', {}).get('minimumGroups', {}).get('groups', [])
                for term in part['expressions'] if self.text.polarity(term) == 'absence']
            found = self.text.found(source.model_text, patterns)
            if found:
                return found, True
            if evidence and self.text.polarity(source.model_text) == 'present':
                return evidence, False
            return [], False
        if terms:
            return terms, True
        for rule in group.rules:
            signals = self.text.found(source.model_text, rule.get('positiveSignals'))
            if evidence and signals:
                return evidence + signals, True
            groups = rule.get('mandatoryConditionGroups', [])
            if evidence and groups and all(self.text.found(scope_text, part['expressions']) for part in groups) and self.text.risk(source.model_text):
                return evidence, True
        return [], False

    def score_pairs(self, pairs):
        """Reaproveito pares iguais só no caso atual, sem cache em disco."""
        missing = list(dict.fromkeys(pair for pair in pairs if ('pair',) + pair not in self.cache))
        fresh = {}
        if missing:
            scores = self.scorer.score(missing)
            if len(scores) != len(missing) or not all(math.isfinite(score) for score in scores):
                raise ValueError('O modelo retornou uma comparação inválida.')
            fresh = dict(zip(missing, scores))
        values = [fresh[pair] if pair in fresh else self.cache[('pair',) + pair] for pair in pairs]
        for pair, value in zip(pairs, values):
            key = ('pair',) + pair
            self.cache[key] = value
            self.cache.move_to_end(key)
        while len(self.cache) > 256:
            self.cache.popitem(last=False)
        return values

    def semantic(self, source, groups):
        if not self.scorer:
            return None
        context = source.inherited_from if source.model_text == source.quote else None
        key = ('interpretation', source.model_text, context, self.index.service_name, self.index.store.version,
            tuple((group.scope, group.key) for group in groups))
        if key in self.cache:
            self.cache.move_to_end(key)
            return self.cache[key]
        # O mesmo relato tem significados diferentes conforme o serviço.
        # A identidade vem do catálogo selecionado, nunca de um fallback fixo.
        query = source.model_text + (f'\nContexto anterior: {context}.' if context else '') + f'\nServiço analisado: {self.index.service_name}'
        scores = self.score_pairs([(query, self.index.criteria(group)) for group in groups])
        if len(scores) != len(groups) or not all(math.isfinite(score) for score in scores):
            raise ValueError('O modelo retornou uma comparação inválida.')
        ranked = sorted(zip(groups, scores), key=lambda item: item[1], reverse=True)
        confident = ranked and ranked[0][1] >= 0 and (len(ranked) == 1 or ranked[0][1] - ranked[1][1] >= .25)
        if not confident and ranked and ranked[0][1] >= -2 and any(self.topic(source.model_text, group) > 0 for group, _ in ranked[:3]):
            # Uma segunda organização do mesmo contexto pode resolver uma
            # paráfrase. Não baixo o limiar e não invento fato para resgatá-la.
            alternate = f'Serviço: {self.index.service_name}. ' + (f'Contexto anterior: {context}. ' if context else '') + f'Relato: {source.model_text}'
            other = self.score_pairs([(alternate, self.index.criteria(group)) for group in groups])
            if len(other) != len(groups) or not all(math.isfinite(score) for score in other):
                raise ValueError('O modelo retornou uma comparação inválida.')
            ranked = sorted(zip(groups, [max(a, b) for a, b in zip(scores, other)]), key=lambda item: item[1], reverse=True)
        result = ranked[0] if ranked and ranked[0][1] >= 0 and (len(ranked) == 1 or ranked[0][1] - ranked[1][1] >= .25) else None
        self.cache[key] = result
        if len(self.cache) > 256:
            self.cache.popitem(last=False)
        return result

    def extract(self, state, sources, intent):
        scoped = [(source, state.scope_of(source)) for source in sources]
        for source, scope in scoped:
            if source.relationship == 'coordination' and source.inherited_from and (
                self.text.uncertain(source.inherited_from) or self.text.denied(source.inherited_from)):
                continue
            state.read_context(source, scope)
        for source, scope in scoped:
            if source.inherited_from and source.model_text == source.quote and state.scope_of(Source(source.inherited_from, source.inherited_from)) != scope:
                # Uma comparação não mistura a OS de origem com o adicional.
                source = replace(source, inherited_from=None, relationship=None)
                state.read_context(source, scope)
            state.sources.append(source)
            is_context = any(fact.quote == source.quote for fact in state.contexts.values())
            normalized = self.text.normalize(source.model_text)
            denied = self.text.denied(source.model_text)
            denied = denied or bool(source.relationship == 'coordination' and source.inherited_from
                and self.text.denied(source.inherited_from))
            if re.search(r'\b(?:expressao|frase|exemplo)\b', normalized):
                continue
            if self.text.uncertain(source.model_text) or (source.relationship == 'coordination' and source.inherited_from and self.text.uncertain(source.inherited_from)):
                if not self.context_only(source.model_text) and not re.fullmatch(r'nao sei(?: informar| dizer)?', normalized):
                    state.unresolved.append(source)
                continue
            if self.text.metadata(source.model_text) and not self.text.risk(source.model_text):
                continue
            if any(rule.get('severity') == 'Conforme' and self.text.found(source.model_text,
                [term for part in rule.get('mandatoryConditionGroups', []) for term in part['expressions']])
                for group in self.index.groups.values() for rule in group.rules):
                continue
            if re.match(r'^(?:nao|não) (?:de |do |da |sobre )', source.model_text, re.I):
                continue
            scope_text = '. '.join(item.model_text for item, value in scoped if value == scope)
            groups = self.index.candidates(scope)
            found = False
            inactive = set()
            for group in groups:
                if not any(state.requirements(rule, scope, source) for rule in group.rules):
                    continue
                if any(rule.get('severity') == 'Conforme' for rule in group.rules):
                    continue
                terms, active = self.lexical(group, source, scope_text)
                if not terms:
                    terms, active = self.contextual(group, source, state, scope)
                if terms:
                    state.put(group, source, scope, active and not denied, terms)
                    found = found or active
                    if not active:
                        inactive.add(group.key)
            if found or (inactive and not self.text.risk(source.model_text)) or (is_context and not self.text.risk(source.model_text)) or denied:
                continue
            if self.context_only(source.model_text):
                # Depois de conferir os fatos lexicais, uma resposta só sobre
                # contexto não disputa uma falha no BGE. "Nem interna" não é
                # uma nova evidência ausente que precise de outra explicação.
                continue
            if self.text.regular(source.model_text):
                continue
            if intent == 'question' and not self.text.risk(source.model_text):
                # Uma consulta sem ocorrência busca o assunto no catálogo;
                # não disputo um defeito como se ele tivesse sido relatado.
                continue
            if re.search(r'\d', normalized) and not self.text.risk(source.model_text):
                # Um valor lançado, sozinho, não declara incoerência. Mantenho
                # o trecho como contexto para uma comparação posterior.
                continue
            # Não exijo uma palavra de uma lista de defeitos para chamar a IA.
            # Ainda filtro condições reais antes de disputar uma conclusão.
            candidates = [group for group in groups if self.eligible(group, source, state, scope, intent, inactive)]
            match = self.semantic(source, candidates)
            if match:
                group, score = match
                if group.stance != 'absence' or self.text.polarity(source.model_text) == 'absence' or intent == 'hypothesis':
                    state.put(group, source, scope, True, [group.rules[0]['title']], score, True)
                    continue
            if self.text.risk(source.model_text):
                state.unresolved.append(source)
