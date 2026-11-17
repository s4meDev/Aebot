"""A forma de responder não pode mudar a decisão ou esconder as fontes."""
from pathlib import Path
import unittest
from aebot.contracts import Evaluation, Match
from aebot.engine import Engine
from aebot.evidence_ui import evaluation_details
from aebot.response import format_response
from aebot.session import Session
from aebot.store import RuleStore

ROOT = Path(__file__).resolve().parents[2]
SERVICE = 'repavimentacao-asfalto-ate-1m2'


class ResponseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.store = RuleStore(ROOT, prototype=True)

    def test_subject_is_a_literal_slice_and_keeps_negation(self):
        for query, expected in [
            ('Quero entender o desfecho que ninguém deixou ver.', 'o desfecho que ninguém deixou ver.'),
            ('Me explique a falta de aferição.', 'a falta de aferição.'),
            ('Pode me explicar por que não há evidência?', 'por que não há evidência?'),
            ('Quero entender', 'Quero entender'),
            ('Sem foto depois.', 'Sem foto depois.'),
        ]:
            self.assertEqual(self.store.text.consultation_subject(query), expected)
            self.assertIn(expected, query)

    def test_consultation_keeps_original_citation_and_never_classifies(self):
        class Scorer:
            calls = 0
            pairs = []
            def score(self, pairs):
                self.calls += 1
                self.pairs.extend(pairs)
                return [2. if criterion.startswith('Falta de registro do resultado final') else -5.
                    for _, criterion in pairs]
        scorer = Scorer()
        query = 'Quero entender o desfecho que ninguém deixou ver.'
        result = Engine(self.store, scorer).evaluate(query, SERVICE)
        self.assertIsNone(result.decision)
        self.assertFalse(result.pendingInformation)
        self.assertTrue(result.matchedRules)
        self.assertTrue(all(item.application == 'consultation' and item.sourceQuote == query
            for item in result.matchedRules))
        self.assertTrue(all('Quero entender' not in query for query, _ in scorer.pairs))

    def test_multiple_findings_keep_actions_and_the_final_decision(self):
        result = Engine(self.store).evaluate('Sem foto depois. Formulário preenchido incorretamente.', SERVICE)
        self.assertEqual(result.decision, 'Reprovado')
        self.assertIn('Também considerei', result.content)
        self.assertIn('RULE-ASF-FORMULARIO-01', result.content)
        self.assertEqual(format_response(result, references=False).count('Base:'), 0)
        detail = evaluation_details(result)
        for match in result.matchedRules:
            self.assertIn(match.id, detail)
            self.assertIn(match.sourceQuote, detail)
            self.assertIn(match.guidance, detail)

    def test_hypothesis_guidance_does_not_become_official_decision(self):
        result = Engine(self.store).evaluate('Se faltar foto depois?', SERVICE)
        self.assertIsNone(result.decision)
        self.assertIn('Nesse cenário', result.content)
        self.assertIn('não classifica a OS real', evaluation_details(result))

    def test_polite_explanation_without_question_mark_is_not_a_report(self):
        for query in ('Pode me explicar a falta de aferição.', 'Gostaria de entender a falta de aferição.',
                      'Explique a falta de aferição.'):
            result = Engine(self.store).evaluate(query, SERVICE)
            self.assertEqual(result.intent, 'question')
            self.assertIsNone(result.decision)
            self.assertFalse(result.pendingInformation)
            self.assertTrue(result.guidanceOptions)
            self.assertTrue(all(item.application == 'consultation' for item in result.matchedRules))

    def test_compact_mode_points_to_the_unabridged_foundations(self):
        result = Evaluation(SERVICE, 'test', '', 'question', guidanceOptions=['caminho ' + str(i) for i in range(5)])
        text = format_response(result, compact=True)
        self.assertIn('mais 2 caminhos', text)
        result.content = format_response(result)
        self.assertIn('caminho 4', evaluation_details(result))

    def test_no_lower_severity_approval_action_contradicts_a_rejection(self):
        primary = Match('one', 'Falha grave', 'Reprovado', 1, 'trecho um', 1., [],
            guidance='Reprove pela falha grave.', message='Falha confirmada.')
        other = Match('two', 'Falha corrigível', 'Não Conforme', 2, 'trecho dois', 1., [],
            guidance='Aprove com a correção.', message='Outro ponto confirmado.')
        result = Evaluation(SERVICE, 'test', '', 'report', decision='Reprovado',
            matchedRules=[primary, other], primaryRule='one')
        result.content = format_response(result)
        self.assertNotIn('Aprove com', result.content)
        self.assertIn('Falha corrigível', result.content)
        self.assertIn('Aprove com a correção.', evaluation_details(result))

    def test_normalization_caches_are_case_bound_and_instance_owned(self):
        first = RuleStore(ROOT, prototype=True)
        other = RuleStore(ROOT, prototype=True)
        first.text.normalize('relato reservado de teste')
        other.text.normalize('outro caso')
        Session(Engine(first)).reset()
        self.assertEqual(first.text.normalize.cache_info().currsize, 0)
        self.assertGreater(other.text.normalize.cache_info().currsize, 0)

    def test_ambiguous_step_asks_about_evidence_versus_execution(self):
        session = Session(Engine(self.store))
        result = session.ask('tem o começo e o pronto, só não tem o pessoal fazendo o serviço', SERVICE)
        self.assertIsNone(result.decision)
        self.assertTrue(result.pendingClarification)
        self.assertIn('registro dessa etapa ou a atividade', result.pendingInformation[0])
        answer = session.ask('Quis dizer: sem foto durante.', SERVICE)
        self.assertEqual(answer.decision, 'Não Conforme')
