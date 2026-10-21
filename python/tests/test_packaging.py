"""Confiro o manifesto e o guia que acompanham a pasta portátil."""
from pathlib import Path
import hashlib
import tempfile
import unittest
from package_app import copy_guides, write_manifest


class PackagingTests(unittest.TestCase):
    def test_manifest_refresh_excludes_only_its_own_file(self):
        artifacts = Path(__file__).resolve().parents[1] / 'artifacts'
        artifacts.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=artifacts) as temporary:
            root = Path(temporary)
            (root / 'guia.txt').write_text('Primeira versão.', encoding='utf-8')
            (root / 'nested').mkdir()
            (root / 'nested/SHA256SUMS.txt').write_text('Aviso do fornecedor.', encoding='utf-8')
            self.assertEqual(write_manifest(root), 2)
            (root / 'guia.txt').write_text('Guia atualizado após testar.', encoding='utf-8')
            self.assertEqual(write_manifest(root), 2)
            rows = (root / 'SHA256SUMS.txt').read_text(encoding='utf-8').splitlines()
            self.assertEqual(len(rows), 2)
            for row in rows:
                digest, relative = row.split('  ', 1)
                self.assertEqual(digest, hashlib.sha256((root / relative).read_bytes()).hexdigest())

    def test_portable_guides_include_a_simple_start_file(self):
        artifacts = Path(__file__).resolve().parents[1] / 'artifacts'
        artifacts.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=artifacts) as temporary:
            root = Path(temporary)
            copy_guides(root)
            start = (root / '00-COMECE-AQUI.txt').read_text(encoding='utf-8')
            self.assertIn('Extrair Tudo', start)
            self.assertIn('AEBOT.exe', start)
            self.assertIn('Pedro Lucas Botelho Naus', start)
            self.assertEqual(start, (root / 'LEIA-ME.txt').read_text(encoding='utf-8'))
            self.assertTrue((root / 'GUIA-FEEDBACK.md').is_file())
