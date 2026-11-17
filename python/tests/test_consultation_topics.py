"""Consultas compostas precisam explicar todos os assuntos, sem criar fatos."""
from pathlib import Path
import unittest
from aebot.engine import Engine
from aebot.session import Session
from aebot.store import RuleStore

ROOT = Path(__file__).resolve().parents[2]
SERVICE = 'repavimentacao-asfalto-ate-1m2'


class ConsultationTopicTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.store = RuleStore(ROOT, prototype=True)

    def test_each_topic_is_retrieved_with_a_literal_citation(self):
        for query, expected in [
            ('Qual é a regra da foto antes e da foto depois?', {'RULE-ASF-FOTO-ANTES-01', 'RULE-ASF-FOTO-DEPOIS-01'}),
            ('Qual é a regra da foto antes e depois?', {'RULE-ASF-FOTO-ANTES-01', 'RULE-ASF-FOTO-DEPOIS-01'}),
            ('Qual a diferença entre foto durante e foto depois?', {'RULE-ASF-FOTO-DURANTE-01', 'RULE-ASF-FOTO-DEPOIS-01'}),
            ('Qual a regra do formulário e da duplicidade?', {'RULE-ASF-FORMULARIO-01', 'RULE-ASF-DUPLICIDADE-01'}),
            ('Qual a regra de foto depois, não de antes?', {'RULE-ASF-FOTO-DEPOIS-01'}),
            ('Me explique a falta de aferição e o formulário errado.', {'RULE-PAV-AFERICAO-INTERNA-01', 'RULE-PAV-AFERICAO-TERCEIRA-01', 'RULE-ASF-FORMULARIO-01'}),
        ]:
            with self.subTest(query=query):
                result = Engine(self.store).evaluate(query, SERVICE)
                self.assertEqual({item.id for item in result.matchedRules}, expected)
                self.assertIsNone(result.decision)
                self.assertFalse(result.hasSufficientEvidence)
                self.assertTrue(all(item.sourceQuote == query and item.application == 'consultation' for item in result.matchedRules))

    def test_query_does_not_remove_a_real_team_pending_in_the_case(self):
        session = Session(Engine(self.store))
        session.ask('Sem aferição da vala.', SERVICE)
        session.ask('Qual a regra da foto antes e depois?', SERVICE)
        self.assertTrue(session.pending)
        self.assertEqual(session.ask('interna', SERVICE).decision, 'Não Conforme')

    def test_an_unrelated_object_is_not_replaced_with_photo(self):
        result = Engine(self.store).evaluate('Qual a regra da foto antes e da sinalização?', SERVICE)
        self.assertEqual({item.id for item in result.matchedRules}, {'RULE-ASF-FOTO-ANTES-01', 'RULE-ASF-EHS-01'})

    def test_negative_rule_subject_keeps_its_negation(self):
        self.assertEqual(self.store.text.consultation_parts('Qual a regra quando não há foto antes?'), ['Qual a regra quando não há foto antes?'])
        self.assertEqual(self.store.text.consultation_parts('Qual a regra de concreto em vez de asfalto?'), ['Qual a regra de concreto em vez de asfalto?'])

    def test_comparing_scopes_repeats_the_subject_not_the_absence_of_the_scope(self):
        result = Engine(self.store).evaluate('Qual é a regra da falta de aferição no serviço atual e na OS de origem?', SERVICE)
        self.assertEqual({item.id for item in result.matchedRules}, {'RULE-PAV-AFERICAO-INTERNA-01', 'RULE-PAV-AFERICAO-TERCEIRA-01', 'RULE-ASF-ORIGEM-AFERICAO-01', 'RULE-ASF-ORIGEM-VCG-01'})
        self.assertFalse(result.pendingInformation)
        self.assertIsNone(result.decision)

    def test_partly_unknown_query_keeps_the_known_guidance_and_asks_about_the_rest(self):
        query = 'Qual a regra do formulário e do almoço da equipe?'
        result = Engine(self.store).evaluate(query, SERVICE)
        self.assertIsNone(result.decision)
        self.assertTrue(result.guidanceOptions)
        self.assertTrue(result.pendingInformation)
        self.assertIn('almoço', result.pendingInformation[0])
        self.assertEqual({item.id for item in result.matchedRules}, {'RULE-ASF-FORMULARIO-01'})

    def test_model_failure_does_not_erase_a_known_point_or_create_a_decision(self):
        class BrokenModel:
            calls = 0
            def score(self, pairs):
                raise RuntimeError('falha sintética')
        result = Engine(self.store, BrokenModel()).evaluate('Sem foto antes e não registraram mais uma coisa.', SERVICE)
        self.assertEqual(result.errorCode, 'SEMANTIC_FAILURE')
        self.assertIsNone(result.decision)
        self.assertIn('pontos já fundamentados', result.content)
        self.assertIn('Isso não fecha a OS', result.content)

    def test_invalid_input_never_clears_the_previous_case(self):
        session = Session(Engine(self.store))
        session.ask('Sem foto antes.', SERVICE)
        before = session.case_last
        for query, service in [('Novo caso: sem foto depois.', 'inexistente'), (' ' * 10, SERVICE), (None, SERVICE), ('x' * 8001, SERVICE), ('consulta', {})]:
            result = session.ask(query, service)
            self.assertTrue(result.errorCode)
            self.assertIs(session.case_last, before)
            self.assertEqual(session.query, 'Sem foto antes.')
        self.assertEqual(session.ask('E sem foto durante.', SERVICE).decision, 'Reprovado')

    def test_clarifying_an_unknown_query_does_not_become_an_os_fault(self):
        session = Session(Engine(self.store))
        session.ask('Sem aferição da vala.', SERVICE)
        session.ask('Qual a regra do formulário e do almoço da equipe?', SERVICE)
        self.assertTrue(session.consultation)
        result = session.ask('Quis dizer: foto depois.', SERVICE)
        self.assertEqual(result.intent, 'question')
        self.assertIsNone(result.decision)
        self.assertEqual({item.id for item in result.matchedRules}, {'RULE-ASF-FOTO-DEPOIS-01'})
        self.assertTrue(all(item.sourceQuote == 'Quis dizer: foto depois.' for item in result.matchedRules))
        self.assertIsNone(session.consultation)
        self.assertEqual(session.ask('interna', SERVICE).decision, 'Não Conforme')

    def test_a_real_follow_up_does_not_answer_an_unrelated_query(self):
        session = Session(Engine(self.store))
        session.ask('Sem foto antes.', SERVICE)
        session.ask('Qual a regra do formulário e do almoço da equipe?', SERVICE)
        result = session.ask('E sem foto durante.', SERVICE)
        self.assertEqual(result.decision, 'Reprovado')
        self.assertFalse(session.consultation)

    def test_new_case_clears_a_query_clarification(self):
        session = Session(Engine(self.store))
        session.ask('Qual a regra do almoço da equipe?', SERVICE)
        session.ask('Novo caso: sem foto depois.', SERVICE)
        self.assertIsNone(session.consultation)
        self.assertEqual(session.case_last.decision, 'Reprovado')

    def test_two_specific_topic_words_do_not_disappear_into_an_ambiguous_model_match(self):
        class UnneededModel:
            calls = 0
            def score(self, pairs):
                raise AssertionError('As palavras específicas da própria base já identificam o assunto.')
        result = Engine(self.store, UnneededModel()).evaluate('Me explique a regra de qualidade do acabamento.', SERVICE)
        self.assertFalse(result.errorCode)
        self.assertEqual({item.id for item in result.matchedRules}, {'RULE-ASF-ACABAMENTO-01'})

    def test_comparison_words_are_not_a_missing_subject(self):
        result = Engine(self.store).evaluate('Me explique a diferença entre interna e terceirizada quando falta aferição.', SERVICE)
        self.assertFalse(result.pendingInformation)
        self.assertEqual({item.id for item in result.matchedRules}, {'RULE-PAV-AFERICAO-INTERNA-01', 'RULE-PAV-AFERICAO-TERCEIRA-01'})


if __name__ == '__main__':
    unittest.main()
