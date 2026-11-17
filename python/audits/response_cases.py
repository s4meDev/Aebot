"""Exijo orientação útil sem transformar consulta ou ambiguidade em ocorrência."""


def cases(store):
    scenarios = [
        dict(name='assunto literal da consulta', turns=['Quero entender o desfecho que ninguém deixou ver.'],
            expectedDecision=None, expectedRules=None, requiredAnyRules=['RULE-ASF-FOTO-DEPOIS-01'],
            pendingRequired=False, expectedIntent='question'),
        dict(name='falta de objeto pede esclarecimento útil',
            turns=['tem o começo e o pronto, só não tem o pessoal fazendo o serviço'],
            expectedDecision=None, expectedRules=[], pendingRequired=True,
            contentContains=['registro dessa etapa ou a atividade não foi executada']),
        dict(name='esclarecer objeto preserva a falta durante',
            turns=['tem o começo e o pronto, só não tem o pessoal fazendo o serviço', 'Quis dizer: sem foto durante.'],
            expectedDecision='Não Conforme', expectedRules=['RULE-ASF-FOTO-DURANTE-01'], pendingRequired=False),
        dict(name='esclarecer presença não cria ausência',
            turns=['tem o começo e o pronto, só não tem o pessoal fazendo o serviço', 'Quis dizer: tem foto durante.'],
            expectedDecision=None, expectedRules=[], pendingRequired=False),
        dict(name='conclusão grave mantém revisão de formulário',
            turns=['Sem foto depois. Formulário preenchido incorretamente.'],
            expectedDecision='Reprovado', expectedRules=['RULE-ASF-FOTO-DEPOIS-01', 'RULE-ASF-FORMULARIO-01'],
            pendingRequired=False, contentContains=['Também considerei']),
        dict(name='hipótese explica também a ação', turns=['Se faltar foto depois?'],
            expectedDecision=None, expectedScenario='Reprovado', expectedRules=['RULE-ASF-FOTO-DEPOIS-01'],
            pendingRequired=False, contentContains=['Nesse cenário', 'Reprove por não evidenciar']),
        dict(name='consulta continua comparando as equipes', turns=['Me explique a falta de aferição.'],
            expectedDecision=None, expectedRules=None, pendingRequired=False,
            contentContains=['equipe interna', 'equipe terceirizada', 'Retrabalho']),
        dict(name='consulta estranha não ganha critério', turns=['Quero entender o almoço da equipe interna.'],
            expectedDecision=None, expectedRules=[], pendingRequired=True),
        dict(name='pedido educado sem interrogação é consulta', turns=['Pode me explicar a falta de aferição.'],
            expectedDecision=None, expectedRules=None, pendingRequired=False, expectedIntent='question',
            contentContains=['equipe interna', 'equipe terceirizada']),
    ]
    return [dict(item, name=item['name'] + ' / ' + sid, serviceId=sid,
        category='Resposta e fundamentos 0.6.0') for sid in store.services for item in scenarios]
