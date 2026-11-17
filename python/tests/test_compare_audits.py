"""Uma entrega não melhora o resultado apagando casos ou mudando expectativas."""
from copy import deepcopy
import unittest
from compare_audits import compare


def report():
    return dict(status='completed', rows=[dict(case=dict(name='caso', serviceId='serviço', expectedDecision=None), strictOk=True, technicalFailure=False)])


class AuditComparisonTests(unittest.TestCase):
    def test_same_cases_and_new_passing_cases_are_allowed(self):
        before, after = report(), report()
        added = deepcopy(after['rows'][0])
        added['case']['name'] = 'novo caso'
        after['rows'].append(added)
        result = compare(before, after)
        self.assertTrue(result['ok'])
        self.assertEqual(result['newCases'], 1)

    def test_changing_the_expected_answer_does_not_hide_a_regression(self):
        before, after = report(), report()
        after['rows'][0]['case']['expectedDecision'] = 'Conforme'
        self.assertFalse(compare(before, after)['ok'])

    def test_omission_failure_and_duplicates_are_rejected(self):
        before, after = report(), report()
        after['rows'] = []
        self.assertFalse(compare(before, after)['ok'])
        after = report()
        after['rows'][0]['technicalFailure'] = True
        self.assertFalse(compare(before, after)['ok'])
        after['rows'].append(deepcopy(after['rows'][0]))
        with self.assertRaises(ValueError):
            compare(before, after)

    def test_a_known_divergence_is_visible_not_turned_into_a_pass(self):
        before, after = report(), report()
        before['rows'][0]['strictOk'] = after['rows'][0]['strictOk'] = False
        result = compare(before, after)
        self.assertTrue(result['ok'])
        self.assertEqual(len(result['retainedDivergences']), 1)
        self.assertFalse(after['rows'][0]['strictOk'])

    def test_incomplete_audit_is_not_accepted(self):
        before, after = report(), report()
        after['status'] = 'running'
        with self.assertRaises(ValueError):
            compare(before, after)
