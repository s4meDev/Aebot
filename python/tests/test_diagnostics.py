"""Um diagnóstico que falhou não pode deixar o acerto antigo no arquivo."""
from pathlib import Path
import json
import tempfile
import unittest
from unittest.mock import patch
import main
from aebot import __version__


class DiagnosticsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary_root = Path(__file__).resolve().parents[1] / 'artifacts'
        cls.temporary_root.mkdir(exist_ok=True)

    def test_failure_replaces_stale_success_without_raw_exception(self):
        with tempfile.TemporaryDirectory(dir=self.temporary_root) as directory:
            target = Path(directory) / 'check.json'
            target.write_text('{"ok":true}', encoding='utf-8')
            with patch('sys.argv', ['AEBOT', '--check', '--report', str(target)]), \
                 patch('main.check_runtime', side_effect=ValueError('não copiar conteúdo da exceção')):
                with self.assertRaises(ValueError):
                    main.main()
            result = json.loads(target.read_text(encoding='utf-8'))
            self.assertFalse(result['ok'])
            self.assertEqual(result['status'], 'failed')
            self.assertEqual(result['technicalException'], 'ValueError')
            self.assertNotIn('copiar', target.read_text(encoding='utf-8'))

    def test_success_records_version_and_completion(self):
        with tempfile.TemporaryDirectory(dir=self.temporary_root) as directory:
            target = Path(directory) / 'check.json'
            def complete(result):
                result['ok'] = True
            with patch('sys.argv', ['AEBOT', '--check', '--report', str(target)]), \
                 patch('main.check_runtime', side_effect=complete), patch('builtins.print'):
                main.main()
            result = json.loads(target.read_text(encoding='utf-8'))
            self.assertTrue(result['ok'])
            self.assertEqual(result['status'], 'completed')
            self.assertEqual(result['version'], __version__)
