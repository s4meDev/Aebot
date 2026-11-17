"""A retificação de 03/11 vem do responsável, não de uma escolha da IA."""
from pathlib import Path
import unittest
from aebot.store import RuleStore
from aebot.engine import Engine
from aebot.session import Session

ROOT = Path(__file__).resolve().parents[2]


class TapePolicyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.store = RuleStore(ROOT, prototype=True)

    def test_current_os_depends_on_team_for_both_area_ranges(self):
        for sid in self.store.services:
            for team, expected, rule_id in [('interna', 'Não Conforme', 'RULE-ASF-TRENA-01'),
                                           ('terceirizada', 'Reprovado', 'RULE-ASF-TRENA-TERCEIRA-01')]:
                with self.subTest(service=sid, team=team):
                    result = Engine(self.store).evaluate(f'Equipe {team}. A trena impede verificar a metragem.', sid)
                    self.assertEqual(result.decision, expected)
                    self.assertEqual(result.primaryRule, rule_id)
                    self.assertFalse(result.pendingInformation)
                    if team == 'interna':
                        self.assertIn('Retrabalho', result.content)

    def test_missing_team_asks_before_concluding(self):
        for sid in self.store.services:
            session = Session(Engine(self.store))
            question = session.ask('A trena impede verificar a metragem.', sid)
            self.assertIsNone(question.decision)
            self.assertEqual(question.pendingContext['dimension'], 'team')
            answer = session.ask('interna', sid)
            self.assertEqual(answer.decision, 'Não Conforme')
            self.assertIn('Retrabalho', answer.content)

    def test_team_correction_replaces_the_old_value(self):
        sid = next(iter(self.store.services))
        session = Session(Engine(self.store))
        session.ask('Equipe terceirizada. A trena impede verificar a metragem.', sid)
        result = session.ask('Corrigindo: a equipe é interna.', sid)
        self.assertEqual(result.decision, 'Não Conforme')
        self.assertNotIn('RULE-ASF-TRENA-TERCEIRA-01', [r.id for r in result.matchedRules])

    def test_an_independent_rejection_still_precedes_the_correction(self):
        sid = next(iter(self.store.services))
        result = Engine(self.store).evaluate('Equipe interna. A trena impede verificar a metragem. Sem foto depois.', sid)
        self.assertEqual(result.decision, 'Reprovado')
        self.assertIn('RULE-ASF-TRENA-01', [r.id for r in result.matchedRules])

    def test_hypothesis_never_classifies_the_real_os(self):
        sid = next(iter(self.store.services))
        result = Engine(self.store).evaluate('Se a equipe é interna e a trena impede verificar a metragem?', sid)
        self.assertIsNone(result.decision)
        self.assertEqual(result.scenarioDecision, 'Não Conforme')

    def test_mention_and_denial_are_not_an_impediment(self):
        sid = next(iter(self.store.services))
        for query in ('Equipe interna usou trena.', 'Equipe interna. A trena não impede verificar a metragem.',
                      'Equipe interna. A trena permite conferir a metragem.'):
            self.assertIsNone(Engine(self.store).evaluate(query, sid).decision, query)

    def test_existing_tape_is_not_proof_that_measurement_is_verifiable(self):
        sid = next(iter(self.store.services))
        result = Engine(self.store).evaluate('A equipe interna apresentou trena que não permite conferir a metragem.', sid)
        self.assertEqual(result.decision, 'Não Conforme')
        self.assertIn('Retrabalho', result.content)
