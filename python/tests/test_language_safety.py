"""Negações e alternativas não podem virar uma ocorrência confirmada."""
from pathlib import Path
import unittest
from aebot.engine import Engine
from aebot.evidence_ui import evaluation_details
from aebot.session import Session
from aebot.store import RuleStore

ROOT = Path(__file__).resolve().parents[2]
SERVICE = 'repavimentacao-asfalto-ate-1m2'


class LanguageSafetyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.store = RuleStore(ROOT, prototype=True)

    def test_negated_absence_does_not_confirm_a_missing_photo(self):
        for query in ('Não está sem foto depois.', 'Não estou sem a foto depois.',
                      'Não ficou sem foto depois.', 'Não ficaram sem foto depois.',
                      'Não faltam fotos depois.', 'Não estavam faltando fotos depois.'):
            with self.subTest(query=query):
                result = Engine(self.store).evaluate(query, SERVICE)
                self.assertIsNone(result.decision)
                self.assertFalse(any(match.severity for match in result.matchedRules))
                self.assertEqual(result.outcome, 'advisory')
                self.assertIn('não está descrito como uma falha', result.content)
                self.assertIn(query.rstrip('.'), evaluation_details(result))
                self.assertFalse(result.hasSufficientEvidence)

    def test_a_negation_cannot_cancel_an_independent_fault(self):
        result = Engine(self.store).evaluate('Não está sem foto depois. Sem foto antes.', SERVICE)
        self.assertEqual(result.decision, 'Não Conforme')
        self.assertEqual([r.id for r in result.matchedRules if r.severity], ['RULE-ASF-FOTO-ANTES-01'])

    def test_negative_correction_deactivates_only_the_previous_missing_record(self):
        session = Session(Engine(self.store))
        session.ask('Sem foto depois. Formulário preenchido incorretamente.', SERVICE)
        result = session.ask('Corrigindo: não está sem foto depois.', SERVICE)
        self.assertEqual(result.decision, 'Não Conforme')
        self.assertEqual([r.id for r in result.matchedRules if r.severity], ['RULE-ASF-FORMULARIO-01'])

    def test_actual_absence_and_emphasis_are_still_faults(self):
        for query in ('Não tem foto depois.', 'Não está apresentando foto depois.',
                      'Não só faltou foto depois.', 'Não faltou só a foto antes: faltou foto depois.'):
            with self.subTest(query=query):
                self.assertEqual(Engine(self.store).evaluate(query, SERVICE).decision, 'Reprovado')

    def test_team_alternatives_require_a_question(self):
        for teams in ('interna ou terceirizada', 'interna/terceirizada', 'terceirizada ou interna'):
            with self.subTest(teams=teams):
                result = Engine(self.store).evaluate('Sem aferição da vala. A equipe é ' + teams + '.', SERVICE)
                self.assertIsNone(result.decision)
                self.assertEqual(result.pendingContext['dimension'], 'team')
                self.assertTrue(result.pendingInformation)

    def test_ambiguous_team_replaces_a_previous_certainty_until_clarified(self):
        session = Session(Engine(self.store))
        session.ask('Equipe interna sem aferição da vala.', SERVICE)
        result = session.ask('Corrigindo: pode ser interna ou terceirizada.', SERVICE)
        self.assertIsNone(result.decision)
        self.assertTrue(result.pendingInformation)
        self.assertEqual(session.ask('terceirizada', SERVICE).decision, 'Reprovado')

    def test_negated_context_never_selects_a_team(self):
        for team in ('Não é uma equipe própria.', 'Nem interna.', 'Nem é terceirizada.'):
            with self.subTest(team=team):
                result = Engine(self.store).evaluate('Sem aferição da vala. ' + team, SERVICE)
                self.assertIsNone(result.decision)
                self.assertTrue(result.pendingInformation)

    def test_explicit_correction_and_separate_scopes_keep_their_values(self):
        result = Engine(self.store).evaluate('Sem aferição da vala. Não é interna, é terceirizada.', SERVICE)
        self.assertEqual(result.decision, 'Reprovado')
        session = Session(Engine(self.store))
        session.ask('Sem aferição na OS atual, equipe interna. Sem aferição na OS de origem, frente manutenção.', SERVICE)
        result = session.ask('Corrigindo na OS atual: interna ou terceirizada.', SERVICE)
        self.assertIsNone(result.decision)
        self.assertEqual(result.pendingContext['scope'], 'current')

    def test_video_noun_can_be_inherited_only_for_a_registered_stage(self):
        query = 'Tem vídeo durante, só falta antes.'
        sources = self.store.text.sources(query)
        self.assertIn('vídeo', sources[-1].model_text)
        self.assertEqual(sources[-1].inherited_from, sources[0].quote)
        result = Engine(self.store).evaluate(query, SERVICE)
        self.assertEqual(result.decision, 'Não Conforme')
        other = self.store.text.sources('Tem vídeo durante, sem sinalização.')
        self.assertNotIn('vídeo', other[-1].model_text)

    def test_correlative_absence_keeps_both_literal_sources(self):
        query = 'Não só faltou foto antes como também foto depois.'
        result = Engine(self.store).evaluate(query, SERVICE)
        self.assertEqual(result.decision, 'Reprovado')
        self.assertEqual({r.id for r in result.matchedRules if r.severity},
            {'RULE-ASF-FOTO-ANTES-01', 'RULE-ASF-FOTO-DEPOIS-01'})
        self.assertTrue(all(r.sourceQuote in query for r in result.matchedRules))
        self.assertTrue(any(r.contextQuotes for r in result.matchedRules))

    def test_flexible_context_accepts_no_empty_expression(self):
        for expression in ('', 'a', 'de'):
            self.assertFalse(self.store.text.flexible('equipe interna', expression, context=True))

    def test_later_assertion_can_resolve_ambiguity_in_the_same_message(self):
        result = Engine(self.store).evaluate('Sem aferição da vala. Equipe interna ou terceirizada. Corrigindo: equipe interna.', SERVICE)
        self.assertEqual(result.decision, 'Não Conforme')
        self.assertFalse(result.pendingInformation)

    def test_other_objects_do_not_become_record_antecedents(self):
        sources = self.store.text.sources('Tem caminhão durante, mas nenhum na etapa final.')
        self.assertEqual(sources[-1].model_text, sources[-1].quote)

    def test_negated_assertion_is_not_an_actual_report(self):
        for verb in ('dizendo', 'relatando', 'confirmando'):
            result = Engine(self.store).evaluate('Não estou ' + verb + ' que faltou foto depois.', SERVICE)
            self.assertIsNone(result.decision)

    def test_denied_context_does_not_block_the_later_clarification(self):
        for team in ('Nem interna.', 'Não é uma equipe própria.'):
            session = Session(Engine(self.store))
            session.ask('Sem aferição da vala. ' + team, SERVICE)
            result = session.ask('terceirizada', SERVICE)
            self.assertEqual(result.decision, 'Reprovado')
            self.assertFalse(result.pendingInformation)

    def test_denying_the_old_team_suspends_it_without_selecting_the_opposite(self):
        session = Session(Engine(self.store))
        session.ask('Equipe interna sem aferição da vala.', SERVICE)
        result = session.ask('Corrigindo: não é uma equipe própria.', SERVICE)
        self.assertIsNone(result.decision)
        self.assertTrue(result.pendingInformation)
        result = session.ask('terceirizada', SERVICE)
        self.assertEqual(result.decision, 'Reprovado')
        self.assertFalse(result.pendingInformation)
