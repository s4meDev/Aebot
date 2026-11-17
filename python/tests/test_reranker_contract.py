"""Saída quebrada do ONNX precisa falhar, não virar um score zero válido."""
from types import SimpleNamespace
import unittest
import numpy as np
from aebot.reranker import LocalReranker


class RerankerContractTests(unittest.TestCase):
    def scorer(self, output):
        scorer = LocalReranker.__new__(LocalReranker)
        encoded = SimpleNamespace(ids=[0, 1], attention_mask=[1, 1], type_ids=[0, 0])
        scorer.tokenizer = SimpleNamespace(encode_batch=lambda _: [encoded])
        scorer.session = SimpleNamespace(get_inputs=lambda: [SimpleNamespace(name='input_ids')], run=lambda *_: output)
        scorer.calls = 0
        return scorer

    def test_empty_and_wrong_shapes_are_not_silently_padded_with_zero(self):
        for output in ([], [np.asarray([])], [np.asarray([[1., 2.]])]):
            with self.subTest(output=str(output)):
                with self.assertRaises(ValueError):
                    self.scorer(output).score([('trecho', 'critério')])

    def test_non_finite_values_are_technical_failures(self):
        for value in (np.nan, np.inf, -np.inf):
            with self.assertRaises(ValueError):
                self.scorer([np.asarray([[value]])]).score([('trecho', 'critério')])

    def test_a_valid_negative_score_is_not_a_model_error(self):
        self.assertEqual(self.scorer([np.asarray([[-3.5]])]).score([('trecho', 'critério')]), [-3.5])

    def test_empty_request_does_not_call_the_model(self):
        scorer = self.scorer([])
        self.assertEqual(scorer.score([]), [])
        self.assertEqual(scorer.calls, 0)
