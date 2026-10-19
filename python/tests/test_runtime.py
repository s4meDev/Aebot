"""Verifico integridade sem modificar pesos reais ou acessar a internet."""
from pathlib import Path
import hashlib
import json
import tempfile
import unittest
from aebot.runtime import verify_model


class RuntimeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary_root = Path(__file__).resolve().parents[1] / 'artifacts'
        cls.temporary_root.mkdir(exist_ok=True)

    def test_missing_model(self):
        with tempfile.TemporaryDirectory(dir=self.temporary_root) as name:
            root = Path(name)
            (root / 'python').mkdir()
            (root / 'python/reranker.lock.json').write_text(json.dumps({'files': {
                'tokenizer.json': {'size': 2, 'sha256': '0' * 64}}}), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'incompleto'):
                verify_model(root)

    def test_valid_size_is_not_enough(self):
        with tempfile.TemporaryDirectory(dir=self.temporary_root) as name:
            root = Path(name)
            (root / 'python/models/bge').mkdir(parents=True)
            (root / 'python/models/bge/tokenizer.json').write_bytes(b'{}')
            (root / 'python/reranker.lock.json').write_text(json.dumps({'files': {
                'tokenizer.json': {'size': 2, 'sha256': '0' * 64}}}), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'integridade'):
                verify_model(root)

    def test_valid_hash(self):
        with tempfile.TemporaryDirectory(dir=self.temporary_root) as name:
            root = Path(name)
            (root / 'python/models/bge').mkdir(parents=True)
            (root / 'python/models/bge/tokenizer.json').write_bytes(b'{}')
            (root / 'python/reranker.lock.json').write_text(json.dumps({'files': {
                'tokenizer.json': {'size': 2, 'sha256': hashlib.sha256(b'{}').hexdigest()}}}), encoding='utf-8')
            self.assertEqual(verify_model(root), root / 'python/models/bge')
