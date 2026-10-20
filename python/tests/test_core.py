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

    def test_general_evidence_question_does_not_retrieve_an_arbitrary_defect(self):
        result = self.engine.evaluate('Quais evidências preciso conferir no asfalto?', SERVICE)
        self.assertIsNone(result.decision)
        self.assertIn('RULE-PAV-INFO-02', [item.id for item in result.matchedRules])

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

    def test_plural_evidence_and_absent_target(self):
        self.assertTrue(self.store.text.has('As fotos estão tremidas.', 'foto'))
        self.assertTrue(self.store.text.has('imagens apresentadas', 'imagem apresentada'))
        self.assertTrue(self.store.text.absent_target('Não foram apresentadas fotos no final.', 'foto'))
        self.assertFalse(self.store.text.absent_target('Sem legenda na foto antes.', 'foto'))

    def test_compositional_absence_uses_the_phase_not_the_whole_sentence(self):
        result = self.engine.evaluate('Sem registro de como estava no começo.', SERVICE)
        self.assertEqual(result.decision, 'Não Conforme')
        self.assertTrue(any('antes' in item.title for item in result.matchedRules))

    def test_new_case_does_not_treat_a_topic_as_a_fault(self):
        for query in ('foto antes', 'acabamento correto', 'a metragem bate com as fotos', 'A foto foi feita antes.'):
            self.assertIsNone(self.engine.evaluate(query, SERVICE).decision)

    def test_before_condition_does_not_trigger_final_quality(self):
        result = self.engine.evaluate('Antes de executarem o asfalto estava desnivelado. Depois ficou bom.', SERVICE)
        self.assertIsNone(result.decision)

    def test_exchange_availability_is_a_required_context(self):
        session = Session(self.engine)
        first = session.ask('O código está errado.', SERVICE)
        self.assertIsNone(first.decision)
        self.assertEqual(first.pendingContext['dimension'], 'exchange')
        second = session.ask('O sistema permite trocar.', SERVICE)
        self.assertEqual(second.decision, 'Não Conforme')
        third = session.ask('Corrigindo: o sistema não permite trocar.', SERVICE)
        self.assertEqual(third.decision, 'Reprovado')

    def test_semantic_request_receives_real_service(self):
        class Recorder:
            calls = 0
            queries = []
            def score(self, pairs):
                self.calls += 1
                self.queries.extend(query for query, _ in pairs)
                return [-100.] * len(pairs)
        recorder = Recorder()
        engine = Engine(self.store, recorder)
        engine.evaluate('O relato tem uma situação diferente para explicar.', SERVICE)
        self.assertTrue(recorder.queries)
        self.assertTrue(all(self.store.services[SERVICE]['name'] in query for query in recorder.queries))

    def test_context_is_bounded(self):
        session = Session(self.engine)
        session.ask('Sem foto antes.', SERVICE)
        result = session.ask('mas ' + 'texto ' * 1500, SERVICE)
        self.assertEqual(result.errorCode, 'INVALID_QUERY')
        self.assertEqual(session.query, 'Sem foto antes.')

    def test_new_case_in_text_also_clears_interpretation_cache(self):
        session = Session(self.engine)
        session.ask('Sem foto antes.', SERVICE)
        self.engine.extractors[SERVICE].cache['sentinel'] = None
        session.ask('Novo caso.', SERVICE)
        self.assertNotIn('sentinel', self.engine.extractors[SERVICE].cache)

    def test_context_recognizes_intermediate_words_but_not_a_new_negation(self):
        from aebot.facts import CaseFacts
        from aebot.contracts import Source
        state = CaseFacts(self.store)
        text = 'não existe no sistema a opção correta para trocar'
        state.read_context(Source(text, text), 'current')
        self.assertEqual(state.context('exchange', 'current').value, 'unavailable')
        state = CaseFacts(self.store)
        state.read_context(Source('não é interna', 'não é interna'), 'current')
        self.assertIsNone(state.context('team', 'current'))

    def test_contrast_preserves_the_literal_context(self):
        query = 'O formulário indica uma área, mas pelas fotos ela é diferente.'
        sources = self.store.text.sources(query)
        self.assertEqual(sources[-1].inherited_from, sources[0].quote)
        self.assertIn(sources[-1].quote, query)

    def test_ellipsis_uses_the_record_but_not_the_previous_polarity(self):
        sources = self.store.text.sources('Tem foto durante, só falta antes.')
        self.assertEqual(sources[-1].model_text, 'só falta foto antes')
        self.assertEqual(sources[-1].inherited_from, 'Tem foto durante')
        session = Session(self.engine)
        session.ask('Sem foto antes nem durante.', SERVICE)
        result = session.ask('Corrigindo: tem foto durante, só falta antes.', SERVICE)
        self.assertEqual(result.decision, 'Não Conforme')
        self.assertEqual(len([item for item in result.matchedRules if item.severity]), 1)

    def test_nobody_showed_is_an_absent_record(self):
        self.assertTrue(self.store.text.absent_target('Ninguém mostrou em foto a condição inicial.', 'foto'))

    def test_missing_record_is_different_from_missing_caption(self):
        result = self.engine.evaluate('Sem legenda na foto depois.', SERVICE)
        self.assertFalse(any('FOTO-DEPOIS' in match.id for match in result.matchedRules))

    def test_multiple_stages_are_not_guessed_as_one(self):
        from aebot.facts import CaseFacts
        from aebot.contracts import Source
        state = CaseFacts(self.store)
        source = Source('Antes e depois', 'Antes e depois')
        state.read_context(source, 'current')
        self.assertIsNone(state.context('stage', 'current', source))

    def test_negated_faults_are_not_decisions(self):
        for query in ('Não é verdade que faltou foto depois.', 'A medição não é incoerente.',
                      'Não confirmei duplicidade no Field.', 'A trena não impede verificar a metragem.'):
            result = self.engine.evaluate(query, SERVICE)
            self.assertIsNone(result.decision, query)
            self.assertFalse(any(match.severity for match in result.matchedRules), query)

    def test_team_correction_replaces_old_context(self):
        session = Session(self.engine)
        session.ask('Equipe terceirizada sem aferição da vala.', SERVICE)
        result = session.ask('Na verdade a equipe era interna.', SERVICE)
        self.assertEqual(result.decision, 'Não Conforme')
        self.assertIn('retrabalho', result.content.lower())
        self.assertFalse(result.pendingInformation)

    def test_present_origin_does_not_cancel_current_absence(self):
        result = self.engine.evaluate('Equipe interna sem aferição da vala atual. A aferição da OS de origem foi apresentada.', SERVICE)
        self.assertEqual(result.decision, 'Não Conforme')

    def test_pending_context_is_typed(self):
        session = Session(self.engine)
        first = session.ask('Sem aferição na OS de origem.', SERVICE)
        self.assertEqual(first.pendingContext, {'dimension': 'front', 'scope': 'origin'})
        result = session.ask('VCG', SERVICE)
        self.assertIsNone(result.decision)
        self.assertTrue(result.matchedRules)
        self.assertFalse(result.pendingInformation)

    def test_unknown_answer_preserves_pending_context(self):
        session = Session(self.engine)
        session.ask('Sem aferição da vala.', SERVICE)
        result = session.ask('não sei informar', SERVICE)
        self.assertTrue(result.contextApplied)
        self.assertIsNone(result.decision)
        self.assertEqual(result.pendingContext['dimension'], 'team')

    def test_correction_preserves_unrelated_fault(self):
        session = Session(self.engine)
        session.ask('Sem foto antes nem durante.', SERVICE)
        result = session.ask('Corrigindo, tem foto antes. Continua sem foto durante.', SERVICE)
        self.assertEqual(result.decision, 'Não Conforme')
        self.assertEqual(len([match for match in result.matchedRules if match.severity]), 1)

    def test_current_and_additional_have_separate_teams(self):
        result = self.engine.evaluate('Equipe interna sem aferição do serviço atual. Equipe terceirizada sem aferição de repavimentação no adicional executado.', SERVICE)
        self.assertEqual(result.decision, 'Não Conforme')
        self.assertEqual(len([match for match in result.matchedRules if match.severity]), 2)

    def test_additional_requires_its_service_not_just_team(self):
        result = self.engine.evaluate('Equipe interna sem aferição no adicional executado.', SERVICE)
        self.assertIsNone(result.decision)
        self.assertTrue(result.pendingInformation)

    def test_physical_exception_is_preserved_with_typed_team(self):
        result = self.engine.evaluate('Equipe interna sem aferição da vala mas aferição apresentada.', SERVICE)
        self.assertIsNone(result.decision)

    def test_shared_front_correction_uses_latest_value(self):
        session = Session(self.engine)
        session.ask('Sem aferição na OS de origem, frente manutenção.', SERVICE)
        result = session.ask('Corrigindo: a frente é VCG.', SERVICE)
        self.assertIsNone(result.decision)
        self.assertFalse(any(match.severity for match in result.matchedRules))

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
