"""Dúvida, resposta pendente e caso real precisam de destinos diferentes."""
from pathlib import Path
import unittest
from aebot.engine import Engine
from aebot.session import Session
from aebot.store import RuleStore

ROOT = Path(__file__).resolve().parents[2]
SERVICE = 'repavimentacao-asfalto-ate-1m2'
OTHER = 'repavimentacao-asfalto-acima-1m2'


class ConversationRoutingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.store = RuleStore(ROOT, prototype=True)

    def session(self):
        return Session(Engine(self.store))

    def test_consultation_focuses_the_current_question_not_the_previous_fact(self):
        session = self.session()
        session.ask('Sem foto antes.', SERVICE)
        question = 'E qual é a regra da foto depois?'
        result = session.ask(question, SERVICE)
        self.assertIsNone(result.decision)
        self.assertFalse(result.contextApplied)
        self.assertEqual(result.primaryRule, 'RULE-ASF-FOTO-DEPOIS-01')
        self.assertTrue(all(item.sourceQuote == question and item.application == 'consultation'
            for item in result.matchedRules))
        self.assertEqual(session.query, 'Sem foto antes.')
        self.assertEqual(session.ask('E sem foto durante.', SERVICE).decision, 'Reprovado')

    def test_rule_question_is_not_a_reply_to_the_real_pending_team(self):
        session = self.session()
        session.ask('Sem aferição da vala.', SERVICE)
        result = session.ask('E me explique a regra da foto depois.', SERVICE)
        self.assertFalse(result.pendingInformation)
        self.assertEqual(result.primaryRule, 'RULE-ASF-FOTO-DEPOIS-01')
        self.assertEqual(session.ask('interna', SERVICE).decision, 'Não Conforme')

    def test_consultation_does_not_discard_a_real_pending_clarification(self):
        session = self.session()
        session.ask('Não registraram uma coisa que não sei explicar.', SERVICE)
        session.ask('E qual é a regra da foto antes?', SERVICE)
        result = session.ask('Quis dizer: sem foto depois.', SERVICE)
        self.assertEqual(result.decision, 'Reprovado')
        self.assertFalse(result.pendingInformation)

    def test_pending_hypothesis_can_be_interrupted_and_resumed(self):
        session = self.session()
        session.ask('Sem foto antes.', SERVICE)
        session.ask('Mas se faltar aferição da vala?', SERVICE)
        result = session.ask('Me explique a regra da foto depois.', SERVICE)
        self.assertEqual(result.intent, 'question')
        self.assertFalse(result.pendingInformation)
        self.assertEqual(result.primaryRule, 'RULE-ASF-FOTO-DEPOIS-01')
        scenario = session.ask('interna', SERVICE)
        self.assertEqual(scenario.intent, 'hypothesis')
        self.assertIsNone(scenario.decision)
        self.assertEqual(scenario.scenarioDecision, 'Não Conforme')
        self.assertFalse(scenario.pendingInformation)
        self.assertNotIn('aferição', session.query)
        self.assertNotIn('interna', session.query)

    def test_explicit_return_to_real_case_cancels_the_pending_simulation(self):
        session = self.session()
        session.ask('Sem foto antes.', SERVICE)
        session.ask('Mas se faltar aferição da vala?', SERVICE)
        result = session.ask('Voltando ao caso real: sem foto durante.', SERVICE)
        self.assertEqual(result.intent, 'report')
        self.assertEqual(result.decision, 'Reprovado')
        self.assertFalse(result.pendingInformation)
        self.assertNotIn('aferição', session.query)
        self.assertIsNone(session.scenario)

    def test_short_answer_may_also_add_a_new_fault_to_the_hypothesis(self):
        session = self.session()
        session.ask('Se faltar aferição da vala?', SERVICE)
        result = session.ask('interna e sem foto depois', SERVICE)
        self.assertIsNone(result.decision)
        self.assertEqual(result.scenarioDecision, 'Reprovado')
        self.assertFalse(result.pendingInformation)
        self.assertEqual(session.query, '')

    def test_unknown_answer_remains_pending_in_the_hypothesis(self):
        session = self.session()
        session.ask('Se faltar aferição da vala?', SERVICE)
        result = session.ask('não sei informar', SERVICE)
        self.assertEqual(result.intent, 'hypothesis')
        self.assertIsNone(result.decision)
        self.assertTrue(result.pendingInformation)
        self.assertEqual(session.query, '')

    def test_changing_service_during_a_consultation_clears_the_old_case(self):
        session = self.session()
        session.ask('Sem foto antes.', SERVICE)
        session.ask('Se faltar aferição da vala?', SERVICE)
        session.ask('Me explique a regra da foto depois.', OTHER)
        self.assertEqual(session.query, '')
        self.assertIsNone(session.scenario)
        result = session.ask('E sem foto durante.', OTHER)
        self.assertEqual(result.decision, 'Não Conforme')
        self.assertFalse(result.contextApplied)

    def test_new_case_text_clears_a_pending_hypothesis(self):
        session = self.session()
        session.ask('Se faltar aferição da vala?', SERVICE)
        result = session.ask('Novo caso: sem foto antes.', SERVICE)
        self.assertEqual(result.decision, 'Não Conforme')
        self.assertIsNone(session.scenario)

    def test_consultation_reuses_only_the_same_cases_memory_cache(self):
        session = self.session()
        session.ask('Sem foto antes.', SERVICE)
        extractor = session.engine.extractors[SERVICE]
        key = ('pair', 'relato sintético', 'critério sintético')
        extractor.cache[key] = 1.
        session.ask('Me explique a regra da foto depois.', SERVICE)
        self.assertIn(key, extractor.cache)
        session.reset()
        self.assertNotIn(key, extractor.cache)

    def test_invalid_service_query_does_not_overwrite_the_current_case(self):
        session = self.session()
        session.ask('Sem foto antes.', SERVICE)
        result = session.ask('Me explique a regra da foto depois.', 'inexistente')
        self.assertEqual(result.errorCode, 'SERVICE_NOT_FOUND')
        self.assertEqual(session.query, 'Sem foto antes.')
