"""Protejo a orientação quando o vínculo informado ainda é contraditório."""
from pathlib import Path
import unittest
from aebot.engine import Engine
from aebot.session import Session
from aebot.store import RuleStore
from aebot.facts import CaseFacts
from aebot.contracts import Source

ROOT = Path(__file__).resolve().parents[2]
SERVICE = 'repavimentacao-asfalto-ate-1m2'


class ReleaseReadinessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.store = RuleStore(ROOT, prototype=True)

    def test_two_asserted_teams_require_clarification(self):
        for teams in ('interna e terceirizada', 'interna, terceirizada', 'interna/terceirizada',
                      'terceirizada e interna', 'interna ou terceirizada'):
            with self.subTest(teams=teams):
                result = Engine(self.store).evaluate('Sem aferição da vala. Equipe ' + teams + '.', SERVICE)
                self.assertIsNone(result.decision)
                self.assertTrue(result.pendingInformation)
                self.assertFalse(any(item.severity for item in result.matchedRules))

    def test_explicit_uncertainty_suspends_the_old_team(self):
        for correction in ('Corrigindo: não sei se é interna.',
                           'Corrigindo: não tenho certeza se é interna.',
                           'Corrigindo: ainda preciso confirmar se é interna.'):
            with self.subTest(correction=correction):
                session = Session(Engine(self.store))
                self.assertEqual(session.ask('Sem aferição da vala. Equipe interna.', SERVICE).decision, 'Não Conforme')
                result = session.ask(correction, SERVICE)
                self.assertIsNone(result.decision)
                self.assertTrue(result.pendingInformation)
                self.assertFalse(any(item.severity for item in result.matchedRules))
                # A nova resposta resolve a pendência, não fica presa à incerteza.
                result = session.ask('terceirizada', SERVICE)
                self.assertEqual(result.decision, 'Reprovado')
                self.assertFalse(result.pendingInformation)

    def test_short_uncertainty_answers_the_pending_context(self):
        session = Session(Engine(self.store))
        session.ask('Sem aferição da vala.', SERVICE)
        result = session.ask('Não tenho certeza se é interna.', SERVICE)
        self.assertIsNone(result.decision)
        self.assertEqual(result.pendingContext['dimension'], 'team')
        self.assertIsNone(result.pendingClarification)
        self.assertEqual(session.ask('interna', SERVICE).decision, 'Não Conforme')

    def test_two_teams_can_be_corrected_without_discarding_the_fault(self):
        session = Session(Engine(self.store))
        session.ask('Sem aferição da vala. Equipe interna e terceirizada.', SERVICE)
        result = session.ask('Corrigindo: é interna.', SERVICE)
        self.assertEqual(result.decision, 'Não Conforme')
        self.assertFalse(result.pendingInformation)
        self.assertIn('Sem aferição da vala', session.query)

    def test_negated_alternative_is_not_a_conflict(self):
        for teams, decision in [('Não é terceirizada, é interna.', 'Não Conforme'),
                                ('Não é interna, é terceirizada.', 'Reprovado')]:
            result = Engine(self.store).evaluate('Sem aferição da vala. ' + teams, SERVICE)
            self.assertEqual(result.decision, decision)
            self.assertFalse(result.pendingInformation)

    def test_a_chronological_correction_keeps_the_latest_value(self):
        for teams, decision in [('Era interna, agora é terceirizada.', 'Reprovado'),
                                ('Era terceirizada, agora é interna.', 'Não Conforme')]:
            result = Engine(self.store).evaluate('Sem aferição da vala. ' + teams, SERVICE)
            self.assertEqual(result.decision, decision)

    def test_uncertain_hypothesis_does_not_change_the_real_case(self):
        session = Session(Engine(self.store))
        session.ask('Sem foto antes.', SERVICE)
        result = session.ask('Se faltar aferição da vala com equipe interna e terceirizada?', SERVICE)
        self.assertIsNone(result.decision)
        self.assertTrue(result.pendingInformation)
        session.ask('interna', SERVICE)
        result = session.ask('Voltando ao caso real: e sem foto durante.', SERVICE)
        self.assertEqual(result.decision, 'Reprovado')
        self.assertFalse(any('aferição' in item.title.lower() for item in result.matchedRules))

    def test_new_case_removes_context_conflicts(self):
        session = Session(Engine(self.store))
        session.ask('Sem aferição da vala. Equipe interna e terceirizada.', SERVICE)
        result = session.ask('Outra OS: sem foto antes.', SERVICE)
        self.assertEqual(result.decision, 'Não Conforme')
        self.assertFalse(result.pendingInformation)

    def test_bare_verb_does_not_confirm_exchange_availability(self):
        for query in ('Preciso trocar.', 'O sistema permite trocar.', 'Não existe no sistema a opção correta para trocar.'):
            state = CaseFacts(self.store)
            state.read_context(Source(query, query), 'current')
            value = state.context('exchange', 'current')
            expected = None if query == 'Preciso trocar.' else 'available' if query == 'O sistema permite trocar.' else 'unavailable'
            self.assertEqual(value.value if value else None, expected)

    def test_a_tentative_team_is_not_a_confirmed_team(self):
        for query in ('Acho que é interna.', 'Pode ser interna.', 'Parece que é terceirizada.',
                      'Provavelmente é interna.', 'Não tenho certeza se é terceirizada.'):
            with self.subTest(query=query):
                session = Session(Engine(self.store))
                session.ask('Sem aferição da vala.', SERVICE)
                result = session.ask(query, SERVICE)
                self.assertIsNone(result.decision)
                self.assertTrue(result.pendingInformation)
                self.assertIsNone(result.pendingClarification)
                self.assertEqual(session.ask('interna', SERVICE).decision, 'Não Conforme')

    def test_front_conflict_does_not_choose_an_exception(self):
        result = Engine(self.store).evaluate('OS de origem sem aferição. Frente VCG e Manutenção.', SERVICE)
        self.assertIsNone(result.decision)
        self.assertTrue(result.pendingInformation)
        self.assertEqual(result.pendingContext['dimension'], 'front')

    def test_uncertain_real_fault_needs_its_own_clarification(self):
        result = Engine(self.store).evaluate('Talvez falte foto depois.', SERVICE)
        self.assertIsNone(result.decision)
        self.assertTrue(result.pendingClarification)
        self.assertFalse(result.matchedRules)


if __name__ == '__main__':
    unittest.main()
