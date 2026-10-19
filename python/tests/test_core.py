"""Regressões independentes da resposta de qualquer modelo neural."""
from pathlib import Path
import unittest
from aebot.store import RuleStore
from aebot.engine import Engine
from aebot.session import Session

ROOT = Path(__file__).resolve().parents[2]
SERVICE = 'repavimentacao-asfalto-ate-1m2'


class CoreTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.store = RuleStore(ROOT)
        cls.engine = Engine(cls.store)

    def test_whole_words(self):
        self.assertFalse(self.store.text.has('serviço incompleto', 'completo'))
        self.assertTrue(self.store.text.has('MEDIÇÃO,   INCOERENTE!', 'medição incoerente'))

    def test_no_default_approval(self):
        result = self.engine.evaluate('O caminhão chegou cedo.', SERVICE)
        self.assertIsNone(result.decision)
        self.assertFalse(result.hasSufficientEvidence)

    def test_unknown_service(self):
        result = self.engine.evaluate('Sem foto depois.', 'inexistente')
        self.assertEqual(result.errorCode, 'SERVICE_NOT_FOUND')
        self.assertFalse(result.matchedRules)

    def test_pending_service(self):
        service = next(item['id'] for item in self.store.services.values() if item.get('analysisStatus') == 'rules_pending')
        self.assertEqual(self.engine.evaluate('Sem foto depois.', service).errorCode, 'RULES_PENDING')

    def test_two_selected_services(self):
        for service in ('repavimentacao-asfalto-ate-1m2', 'repavimentacao-asfalto-acima-1m2'):
            result = self.engine.evaluate('SEM FOTO DEPOIS!!!', service)
            self.assertEqual(result.serviceId, service)
            self.assertEqual(result.decision, 'Reprovado')

    def test_informative_not_actual_os(self):
        result = self.engine.evaluate('Qual a regra da foto antes?', SERVICE)
        self.assertIsNone(result.decision)
        self.assertEqual(result.outcome, 'informational')
        self.assertTrue(any('antes' in match.title for match in result.matchedRules))

    def test_hypothesis_not_actual_os(self):
        result = self.engine.evaluate('Se faltar foto depois, reprova?', SERVICE)
        self.assertIsNone(result.decision)
        self.assertEqual(result.scenarioDecision, 'Reprovado')

    def test_mentions_do_not_imply_absence(self):
        for query in ('antes', 'foto durante', 'foto depois', 'Usaram trena.'):
            self.assertIsNone(self.engine.evaluate(query, SERVICE).decision, query)

    def test_presence_does_not_imply_absence(self):
        for query in ('Tem foto depois.', 'Não faltou foto depois.', 'Não está faltando foto depois.'):
            self.assertIsNone(self.engine.evaluate(query, SERVICE).decision, query)

    def test_passive_voice(self):
        result = self.engine.evaluate('A foto final não foi apresentada.', SERVICE)
        self.assertEqual(result.decision, 'Reprovado')
        self.assertFalse(self.store.text.missing_subject('A foto final sem nitidez.', ['foto final']))

    def test_all_relevant_rules_and_aggregation(self):
        result = self.engine.evaluate('Sem foto antes nem durante.', SERVICE)
        self.assertEqual(result.decision, 'Reprovado')
        self.assertEqual(len([item for item in result.matchedRules if item.severity]), 3)
        aggregate = next(item for item in result.matchedRules if item.supportingRuleIds)
        self.assertEqual(len(aggregate.supportingRuleIds), 2)

    def test_conflict_only_with_actual_facts(self):
        result = self.engine.evaluate('Formulário preenchido incorretamente e sem foto depois.', SERVICE)
        self.assertEqual(result.decision, 'Reprovado')
        self.assertTrue(result.conflicts)

    def test_partial_recognition_cannot_finish_os(self):
        result = self.engine.evaluate('Sem foto antes e não registraram uma coisa que não sei explicar.', SERVICE)
        self.assertIsNone(result.decision)
        self.assertTrue(result.matchedRules)

    def test_team_question_then_internal(self):
        session = Session(self.engine)
        first = session.ask('Sem aferição da vala.', SERVICE)
        self.assertIsNone(first.decision)
        self.assertTrue(first.pendingInformation)
        second = session.ask('interna', SERVICE)
        self.assertEqual(second.decision, 'Não Conforme')
        self.assertTrue(second.contextApplied)
        self.assertFalse(second.pendingInformation)

    def test_team_question_then_contractor(self):
        session = Session(self.engine)
        session.ask('Sem aferição da vala.', SERVICE)
        second = session.ask('terceirizada', SERVICE)
        self.assertEqual(second.decision, 'Reprovado')
        self.assertFalse(second.pendingInformation)

    def test_team_answer_with_extra_fault(self):
        session = Session(self.engine)
        session.ask('Sem aferição da vala.', SERVICE)
        result = session.ask('interna e sem foto depois', SERVICE)
        self.assertEqual(result.decision, 'Reprovado')
        self.assertGreaterEqual(len([item for item in result.matchedRules if item.severity]), 2)

    def test_context_continuation_and_new_case(self):
        session = Session(self.engine)
        session.ask('Sem foto antes.', SERVICE)
        self.assertEqual(session.ask('mas sem foto durante também', SERVICE).decision, 'Reprovado')
        session.reset()
        self.assertEqual(session.ask('Sem foto durante.', SERVICE).decision, 'Não Conforme')
        self.assertFalse(session.ask('Outro caso: sem foto antes.', SERVICE).contextApplied)

    def test_correction_removes_old_absence(self):
        session = Session(self.engine)
        session.ask('Sem foto depois.', SERVICE)
        result = session.ask('Corrigindo, tem foto depois.', SERVICE)
        self.assertIsNone(result.decision)

    def test_vcg_is_not_approval_or_origin_penalty(self):
        result = self.engine.evaluate('Sem aferição na OS de origem, é VCG.', SERVICE)
        self.assertIsNone(result.decision)
        self.assertFalse(any(item.severity for item in result.matchedRules))

    def test_full_inspection_does_not_override_fault(self):
        result = self.engine.evaluate('Todos os critérios da repavimentação conferidos sem irregularidades. Sem foto depois.', SERVICE)
        self.assertEqual(result.decision, 'Reprovado')

    def test_original_quotes_are_preserved(self):
        sources = self.store.text.sources('Sem registro antes nem durante.')
        self.assertEqual(sources[1].quote, 'nem durante')
        self.assertEqual(sources[1].inherited_from, 'Sem registro antes')

    def test_engine_is_not_service_specific(self):
        engine_source = (ROOT / 'python/aebot/engine.py').read_text(encoding='utf-8')
        for term in ('RULE-ASF', 'RULE-RC', 'virola', 'cavalete', 'asfalto', 'terceirizada'):
            self.assertNotIn(term, engine_source)

    def test_context_is_bounded(self):
        session = Session(self.engine)
        session.ask('Sem foto antes.', SERVICE)
        result = session.ask('mas ' + 'texto ' * 1500, SERVICE)
        self.assertEqual(result.errorCode, 'INVALID_QUERY')
        self.assertEqual(session.query, 'Sem foto antes.')

    def test_model_failure_is_not_a_business_decision(self):
        class BrokenModel:
            calls = 0
            def score(self, pairs):
                raise RuntimeError('modelo indisponível')
        result = Engine(self.store, BrokenModel()).evaluate('Sem foto antes e não registraram mais uma coisa.', SERVICE)
        self.assertIsNone(result.decision)
        self.assertEqual(result.errorCode, 'SEMANTIC_FAILURE')
        self.assertTrue(result.matchedRules)


if __name__ == '__main__':
    unittest.main()
