"""O resumo da tela é uma projeção da avaliação, nunca um segundo motor."""
from pathlib import Path
import unittest
from aebot.case_overview import build_overview
from aebot.engine import Engine
from aebot.session import Session
from aebot.store import RuleStore


class OverviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.store = RuleStore(Path(__file__).resolve().parents[2], prototype=True)
        cls.service = next(iter(cls.store.services))

    def test_pending_choices_are_exactly_the_registered_values(self):
        result = Engine(self.store).evaluate('Sem aferição da vala.', self.service)
        overview = build_overview(self.store, result, result)
        context = next(item for item in self.store.data['interpretation']['contexts'] if item['id'] == result.pendingContext['dimension'])
        self.assertEqual([item.text for item in overview.answers], [item['expressions'][0] for item in context['values']])
        self.assertEqual(overview.question, result.pendingInformation[0])
        self.assertIsNone(result.decision)

    def test_uncertain_context_does_not_show_old_team_as_confirmed(self):
        session = Session(Engine(self.store))
        session.ask('Sem aferição da vala. Equipe interna.', self.service)
        result = session.ask('Corrigindo: não tenho certeza se é interna.', self.service)
        overview = build_overview(self.store, result, result)
        self.assertTrue(any('A confirmar' in item for item in overview.contexts))
        self.assertFalse(any('· Equipe interna' in item for item in overview.contexts))

    def test_query_does_not_become_a_finding(self):
        session = Session(Engine(self.store))
        session.ask('Sem foto antes.', self.service)
        session.ask('Qual a regra da foto depois?', self.service)
        overview = build_overview(self.store, session.case_last, session.pending)
        self.assertTrue(any('Sem foto antes' in line for line in overview.findings))
        self.assertFalse(any('depois' in line for line in overview.findings))

    def test_hypothesis_is_marked_and_no_official_decision_is_created(self):
        session = Session(Engine(self.store))
        session.ask('Se faltar aferição?', self.service)
        overview = build_overview(self.store, session.scenario.last, session.pending)
        self.assertEqual(overview.title, 'Simulação isolada')
        self.assertIn('OS real', overview.note)
        self.assertIsNone(session.scenario.last.decision)

    def test_new_case_has_no_previous_quotes_or_answers(self):
        session = Session(Engine(self.store))
        session.ask('Sem aferição.', self.service)
        session.reset()
        overview = build_overview(self.store, session.case_last, session.pending)
        self.assertFalse(overview.contexts or overview.findings or overview.answers)

    def test_negated_absence_is_not_shown_as_active_finding(self):
        result = Engine(self.store).evaluate('Não está sem foto depois.', self.service)
        self.assertFalse(build_overview(self.store, result).findings)
