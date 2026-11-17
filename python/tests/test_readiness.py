"""Regressões de conversa e cobertura, escritas antes da correção do motor."""
from pathlib import Path
import unittest
from aebot.store import RuleStore
from aebot.engine import Engine
from aebot.session import Session

ROOT = Path(__file__).resolve().parents[2]
SERVICE = 'repavimentacao-asfalto-ate-1m2'


class ReadinessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.store = RuleStore(ROOT, prototype=True)

    def test_new_object_never_inherits_the_previous_photo_noun(self):
        for query in ('Sem foto antes e sem sinalização.', 'Sem foto antes nem sinalização.'):
            sources = self.store.text.sources(query)
            self.assertNotIn('foto', sources[-1].model_text.lower())
            result = Engine(self.store).evaluate(query, SERVICE)
            self.assertEqual(result.decision, 'Não Conforme')
            self.assertNotIn('RULE-ASF-FOTOS-COMBINADAS-01', [rule.id for rule in result.matchedRules])

    def test_other_predication_is_separated_without_inventing_a_quote(self):
        for query in ('Sem foto antes e acabamento mal feito.', 'Sem foto antes junto com acabamento péssimo.'):
            sources = self.store.text.sources(query)
            self.assertEqual(len(sources), 2)
            self.assertNotIn('foto', sources[-1].model_text)
            self.assertIn(sources[-1].quote, query)

    def test_denial_is_preserved_in_a_negative_coordination(self):
        result = Engine(self.store).evaluate('Não faltou foto antes nem sinalização.', SERVICE)
        self.assertIsNone(result.decision)
        self.assertFalse(any(rule.severity for rule in result.matchedRules))

    def test_temporal_clause_keeps_its_literal_antecedent(self):
        for query in ('Não há foto da fase inicial nem de quando aplicaram a massa.',
                      'Não registraram a vala antes do trabalho nem o serviço sendo feito.',
                      'Não tem imagens do início nem deles fazendo a repavimentação.'):
            sources = self.store.text.sources(query)
            self.assertEqual(sources[-1].inherited_from, sources[0].quote)
            self.assertIn(sources[-1].quote, query)
            self.assertNotEqual(sources[-1].model_text, sources[-1].quote)

    def test_uncertain_negative_coordination_cannot_confirm_a_context(self):
        result = Engine(self.store).evaluate('Sem aferição da vala. Não confirmei se é interna nem estou afirmando que é terceirizada.', SERVICE)
        self.assertIsNone(result.decision)
        self.assertTrue(result.pendingInformation)
        self.assertFalse(any(fact['dimension'] == 'team' for fact in result.contextFacts))

    def test_denied_statement_is_not_team_evidence(self):
        result = Engine(self.store).evaluate('Sem aferição da vala. Não estou afirmando que a equipe é interna.', SERVICE)
        self.assertIsNone(result.decision)
        self.assertTrue(result.pendingInformation)
        self.assertFalse(any(fact['dimension'] == 'team' for fact in result.contextFacts))

    def test_a_word_starting_with_a_connector_is_not_a_continuation(self):
        session = Session(Engine(self.store))
        session.ask('Sem foto depois.', SERVICE)
        result = session.ask('Massa de asfalto aplicada corretamente.', SERVICE)
        self.assertFalse(result.contextApplied)
        self.assertIsNone(result.decision)

    def test_unknown_topic_is_not_retrieved_just_because_it_mentions_team(self):
        result = Engine(self.store).evaluate('Me explique o almoço da equipe interna.', SERVICE)
        self.assertIsNone(result.decision)
        self.assertFalse(result.matchedRules)
        self.assertTrue(result.pendingInformation)
        session = Session(Engine(self.store))
        session.ask('Sem foto antes.', SERVICE)
        session.ask('Me explique o almoço da equipe interna.', SERVICE)
        self.assertNotIn('almoço', session.query)

    def test_consultation_is_explicitly_not_a_confirmed_fact(self):
        result = Engine(self.store).evaluate('Me explique a falta de aferição.', SERVICE)
        self.assertTrue(result.matchedRules)
        self.assertTrue(all(rule.application == 'consultation' for rule in result.matchedRules))
        self.assertIsNone(result.decision)

    def test_explicit_clarification_replaces_only_the_ambiguous_point(self):
        session = Session(Engine(self.store))
        first = session.ask('Sem foto antes. Não registraram uma coisa que não sei explicar.', SERVICE)
        self.assertTrue(first.pendingClarification)
        result = session.ask('Quis dizer: sem foto durante.', SERVICE)
        self.assertEqual(result.decision, 'Reprovado')
        self.assertFalse(result.pendingInformation)
        self.assertIn('RULE-ASF-FOTOS-COMBINADAS-01', [rule.id for rule in result.matchedRules])
        self.assertTrue(result.contextApplied)

    def test_new_fault_alone_does_not_erase_the_unresolved_point(self):
        session = Session(Engine(self.store))
        session.ask('Sem foto antes. Não registraram uma coisa que não sei explicar.', SERVICE)
        result = session.ask('E sem foto durante.', SERVICE)
        self.assertIsNone(result.decision)
        self.assertTrue(result.pendingClarification)

    def test_clarification_is_retained_in_the_same_case_but_reset_clears_it(self):
        session = Session(Engine(self.store))
        session.ask('Não registraram algo que não sei explicar.', SERVICE)
        session.ask('Quis dizer: sem foto antes.', SERVICE)
        self.assertEqual(session.ask('E sem foto durante.', SERVICE).decision, 'Reprovado')
        session.reset()
        self.assertFalse(session.ignored_sources)
        self.assertEqual(session.ask('Sem foto antes.', SERVICE).decision, 'Não Conforme')

    def test_context_quotes_do_not_reuse_a_discarded_antecedent(self):
        session = Session(Engine(self.store))
        session.ask('Não registraram uma coisa que não sei explicar.', SERVICE)
        result = session.ask('Na verdade: sem foto depois.', SERVICE)
        self.assertEqual(result.decision, 'Reprovado')
        self.assertTrue(all('não sei explicar' not in quote for rule in result.matchedRules for quote in rule.contextQuotes))

    def test_pair_cache_is_bounded_and_cleared_between_cases(self):
        from aebot.facts import FactIndex
        from aebot.extraction import Extractor
        class Scorer:
            calls = 0
            def score(self, pairs):
                self.calls += 1
                return [float(len(text)) for text, _ in pairs]
        scorer = Scorer()
        extractor = Extractor(FactIndex(self.store, SERVICE), scorer)
        self.assertEqual(extractor.score_pairs([('a', 'b')]), [1.])
        self.assertEqual(extractor.score_pairs([('a', 'b'), ('cc', 'd')]), [1., 2.])
        self.assertEqual(scorer.calls, 2)
        self.assertEqual(extractor.score_pairs([('a', 'b')]), [1.])
        self.assertEqual(scorer.calls, 2)
        extractor.score_pairs([(str(i), 'x') for i in range(300)])
        self.assertLessEqual(len(extractor.cache), 256)
        engine = Engine(self.store, scorer)
        engine.extractors[SERVICE] = extractor
        Session(engine)
        self.assertFalse(extractor.cache)


if __name__ == '__main__':
    unittest.main()
