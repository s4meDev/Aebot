"""O pacote só conhece o escopo escolhido, mas preserva os mesmos critérios."""
from pathlib import Path
import hashlib
import unittest
from aebot.store import RuleStore
from aebot.engine import Engine
from aebot.session import Session
from aebot.rulebook import rule_details

ROOT = Path(__file__).resolve().parents[2]
SERVICE = 'repavimentacao-asfalto-ate-1m2'


class ProfileTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.full = RuleStore(ROOT)
        cls.store = RuleStore(ROOT, prototype=True)

    def test_only_selected_services_are_available(self):
        self.assertEqual(list(self.store.services), self.store.profile['serviceIds'])
        self.assertEqual(len(self.store.services), 2)
        self.assertEqual(Engine(self.store).evaluate('Sem foto depois.', 'reparo-cavalete').errorCode, 'SERVICE_NOT_FOUND')

    def test_hypothetical_follow_up_does_not_pollute_the_real_case(self):
        session = Session(Engine(self.store))
        actual = session.ask('Equipe interna sem aferição da vala.', SERVICE)
        self.assertEqual(actual.decision, 'Não Conforme')
        scenario = session.ask('Mas se faltar foto depois?', SERVICE)
        self.assertIsNone(scenario.decision)
        self.assertEqual(scenario.intent, 'hypothesis')
        self.assertEqual(scenario.scenarioDecision, 'Reprovado')
        self.assertNotIn('faltar foto depois', session.query)
        resumed = session.ask('E formulário preenchido incorretamente.', SERVICE)
        self.assertEqual(resumed.decision, 'Não Conforme')
        self.assertNotIn('RULE-ASF-FOTO-DEPOIS-01', {rule.id for rule in resumed.matchedRules})

    def test_hypothesis_can_receive_a_short_context_answer_without_classifying(self):
        session = Session(Engine(self.store))
        question = session.ask('Se faltar aferição da vala?', SERVICE)
        self.assertTrue(question.pendingInformation)
        answer = session.ask('interna', SERVICE)
        self.assertIsNone(answer.decision)
        self.assertEqual(answer.scenarioDecision, 'Não Conforme')
        self.assertEqual(answer.intent, 'hypothesis')
        self.assertEqual(session.query, '')
        actual = session.ask('Sem foto depois.', SERVICE)
        self.assertEqual(actual.decision, 'Reprovado')

    def test_question_follow_up_does_not_classify_a_real_case(self):
        session = Session(Engine(self.store))
        session.ask('Sem foto antes.', SERVICE)
        answer = session.ask('E qual é a regra da foto depois', SERVICE)
        self.assertIsNone(answer.decision)
        self.assertNotIn('regra da foto depois', session.query)
        self.assertEqual(session.ask('E formulário preenchido incorretamente.', SERVICE).decision, 'Não Conforme')

    def test_projection_preserves_rules_and_their_conditions(self):
        for service in self.store.services:
            expected = {rule['id']: rule for rule in self.full.for_service(service)}
            actual = {rule['id']: rule for rule in self.store.for_service(service)}
            self.assertEqual(set(actual), set(expected))
            for rule_id, rule in actual.items():
                for field in ('severity', 'guidance', 'evaluation', 'mandatoryConditionGroups', 'exceptions', 'matchPolicy', 'semanticCriteria'):
                    self.assertEqual(rule.get(field), expected[rule_id].get(field), (rule_id, field))

    def test_projection_has_no_unknown_references(self):
        for rule in self.store.rules:
            self.assertIn(rule['serviceId'], self.store.services)
            self.assertTrue(set(rule.get('applicableServiceIds', [])).issubset(self.store.services))

    def test_projection_is_stable_when_loaded_from_the_package(self):
        self.assertEqual(self.store.project(list(self.store.services)), self.store.data)

    def test_offline_diagram_is_current_and_covers_the_projected_rules(self):
        document = (ROOT / 'docs/FLUXO-ASFALTO.html').read_text(encoding='utf-8')
        self.assertIn(hashlib.sha256((ROOT / 'src/data/rulesStore.json').read_bytes()).hexdigest(), document)
        self.assertIn("default-src 'none'", document)
        self.assertNotIn('<script', document)
        self.assertNotIn('https://', document)
        for rule in self.store.rules:
            self.assertIn('id="' + rule['id'] + '"', document)

    def test_free_wording_question_can_retrieve_by_semantics_without_deciding(self):
        target = next(rule for rule in self.store.rules if rule['id'] == 'RULE-ASF-FOTO-DEPOIS-01')
        criterion = target['semanticCriteria'][0]
        class Scorer:
            calls = 0
            def score(self, pairs):
                self.calls += 1
                return [10. if candidate == criterion else -100. for _, candidate in pairs]
        scorer = Scorer()
        result = Engine(self.store, scorer).evaluate('Quero entender o desfecho que ninguém deixou ver.', SERVICE)
        self.assertGreater(scorer.calls, 0)
        self.assertIsNone(result.decision)
        self.assertEqual(result.outcome, 'informational')
        self.assertTrue(result.semanticApplied)
        self.assertIn(target['id'], {rule.id for rule in result.matchedRules})

    def test_failed_semantic_consultation_is_not_a_missing_business_rule(self):
        class Scorer:
            calls = 0
            def score(self, pairs):
                raise RuntimeError('indisponível')
        result = Engine(self.store, Scorer()).evaluate('Quero entender o desfecho que ninguém deixou ver.', SERVICE)
        self.assertEqual(result.errorCode, 'SEMANTIC_FAILURE')
        self.assertIsNone(result.decision)

    def test_rulebook_shows_context_and_exceptions(self):
        rule = next(rule for rule in self.store.rules if rule['id'] == 'RULE-ASF-ORIGEM-VCG-01')
        detail = rule_details(self.store, rule)
        self.assertIn('OS de origem', detail)
        self.assertIn('frente VCG', detail)
        self.assertIn('não aprova automaticamente', detail)

    def test_general_team_question_explains_both_paths_without_asking(self):
        result = Engine(self.store).evaluate('Me explique a falta de aferição.', SERVICE)
        self.assertIsNone(result.decision)
        self.assertFalse(result.pendingInformation)
        self.assertTrue(result.guidanceOptions)
        self.assertIn('equipe interna', result.content)
        self.assertIn('equipe terceirizada', result.content)
        self.assertIn('Retrabalho', result.content)

    def test_compare_current_and_origin_does_not_mix_the_exceptions(self):
        result = Engine(self.store).evaluate('Qual a diferença entre falta de aferição no serviço atual e na OS de origem?', SERVICE)
        self.assertIsNone(result.decision)
        ids = {rule.id for rule in result.matchedRules}
        self.assertIn('RULE-PAV-AFERICAO-INTERNA-01', ids)
        self.assertIn('RULE-PAV-AFERICAO-TERCEIRA-01', ids)
        self.assertIn('RULE-ASF-ORIGEM-VCG-01', ids)
        self.assertIn('RULE-ASF-ORIGEM-AFERICAO-01', ids)

    def test_question_comparing_teams_does_not_choose_the_last_mentioned(self):
        result = Engine(self.store).evaluate('Qual a diferença na falta de aferição entre equipe interna e terceirizada?', SERVICE)
        ids = {rule.id for rule in result.matchedRules}
        self.assertIn('RULE-PAV-AFERICAO-INTERNA-01', ids)
        self.assertIn('RULE-PAV-AFERICAO-TERCEIRA-01', ids)
        self.assertIsNone(result.decision)

    def test_real_case_still_requires_team_information(self):
        result = Engine(self.store).evaluate('Qual a conclusão desta OS sem aferição?', SERVICE)
        self.assertIsNone(result.decision)
        self.assertTrue(result.pendingInformation)

    def test_partial_case_has_specific_guidance_but_no_final_decision(self):
        result = Engine(self.store).evaluate('Sem foto antes e não registraram algo que não sei explicar.', SERVICE)
        self.assertIsNone(result.decision)
        self.assertIn('foto antes', result.content)
        self.assertTrue(result.pendingInformation)

    def test_unknown_profile_service_fails_closed(self):
        with self.assertRaises(ValueError):
            self.full.project(['inexistente'])


if __name__ == '__main__':
    unittest.main()
