"""Projeto o estado da conversa para a tela, sem criar fatos ou decisões."""
from dataclasses import dataclass


@dataclass(frozen=True)
class ContextAnswer:
    label: str
    text: str


@dataclass(frozen=True)
class CaseOverview:
    title: str
    note: str
    contexts: tuple[str, ...] = ()
    findings: tuple[str, ...] = ()
    question: str = ''
    answers: tuple[ContextAnswer, ...] = ()


def build_overview(store, case=None, pending=None):
    config = store.data.get('interpretation', {})
    scopes = {item['id']: item['expressions'][0] for item in config.get('scopes', [])}
    definitions = {item['id']: item for item in config.get('contexts', []) if not item.get('perStatement')}
    question = pending.pendingInformation[0] if pending and pending.pendingInformation else ''
    answers = ()
    if question and pending.pendingContext and not pending.errorCode:
        definition = definitions.get(pending.pendingContext['dimension'])
        if definition:
            # O clique é uma declaração explícita do analista. As opções e o
            # texto enviado vêm do cadastro, nunca de uma decisão da tela.
            answers = tuple(ContextAnswer(value['label'], value['expressions'][0]) for value in definition['values'])
    if case is None:
        return CaseOverview('Contexto da OS', 'Nenhuma ocorrência relatada neste caso.', question=question, answers=answers)
    title = 'Simulação isolada' if case.intent == 'hypothesis' else 'Contexto da OS'
    note = 'Não altera nem classifica a OS real.' if case.intent == 'hypothesis' else 'Somente o que foi relatado neste caso; confira nas evidências.'
    facts = {(item['dimension'], item['scope']): item for item in case.contextFacts if item['dimension'] in definitions}
    active = [item for item in case.observations if item['active']]
    used_scopes = list(dict.fromkeys([item['scope'] for item in active] + ([case.activeScope] if case.activeScope else [])))
    contexts = []
    for scope in used_scopes:
        for key, definition in definitions.items():
            matching = [fact for (dimension, _), fact in facts.items() if dimension == key]
            actual = matching[-1] if definition.get('shared') and matching else facts.get((key, scope), facts.get((key, '*')))
            if actual:
                label = next((value['label'] for value in definition['values'] if value['id'] == actual['value']), 'A confirmar — ' + definition['question'])
                contexts.append(scopes.get(scope, scope).capitalize() + ' · ' + label)
    findings = list(dict.fromkeys(scopes.get(item['scope'], item['scope']).capitalize() + ': “' + item['source']['quote'] + '”' for item in active))
    return CaseOverview(title, note, tuple(dict.fromkeys(contexts)), tuple(findings), question, answers)
