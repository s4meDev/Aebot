"""O fluxograma precisa refletir a base, não cadastrar critérios paralelos."""
from pathlib import Path
import hashlib
import unittest
import xml.etree.ElementTree as ET
from aebot.analysis_flow import AnalysisFlow, STAGES
from aebot.store import RuleStore

ROOT = Path(__file__).resolve().parents[2]


class AnalysisFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.store = RuleStore(ROOT, prototype=True)
        cls.hash = hashlib.sha256((ROOT / 'src/data/rulesStore.json').read_bytes()).hexdigest()

    def test_projected_rules_keep_every_condition_and_exception(self):
        flow = AnalysisFlow.from_store(self.store, self.hash)
        self.assertEqual(flow.to_dict()['rules'], self.store.rules)
        self.assertEqual(flow.to_dict()['interpretation'], self.store.data['interpretation'])
        self.assertEqual(flow.to_dict()['sourceSha256'], self.hash)
        self.assertTrue(flow.to_dict()['generated'])

    def test_projection_is_independent_and_never_mutates_the_source(self):
        flow = AnalysisFlow.from_store(self.store, self.hash)
        flow.rules[0]['title'] = 'Só a cópia de teste'
        self.assertNotEqual(flow.rules[0]['title'], self.store.rules[0]['title'])

    def test_all_rule_ids_and_aggregator_support_are_visible(self):
        diagram = AnalysisFlow.from_store(self.store, self.hash).mermaid()
        for rule in self.store.rules:
            self.assertIn(rule['id'], diagram)
        self.assertIn('fato independente confirmado', diagram)
        self.assertIn('decisão nula', diagram)
        self.assertIn('não classificar a OS real', diagram)

    def test_object_owners_point_to_real_modules(self):
        for stage in STAGES:
            self.assertTrue((ROOT / 'python' / stage.owner).is_file())

    def test_svg_is_valid_and_technical_branches_have_text_alternatives(self):
        diagram = AnalysisFlow.from_store(self.store, self.hash).svg()
        root = ET.fromstring(diagram)
        self.assertEqual(root.attrib['role'], 'img')
        self.assertIn('Esclarecimento / retificação', diagram)
        self.assertIn('Combinar TODOS', diagram)
        self.assertNotIn('RULE-', diagram)


if __name__ == '__main__':
    unittest.main()
