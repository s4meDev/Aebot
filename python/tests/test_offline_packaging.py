"""O ZIP público não recebe arquivos extras nem mistura uma entrega fechada."""
from pathlib import Path
import tempfile
import unittest
import zipfile
from package_offline import refresh_guides, zip_delivery


class OfflinePackagingTests(unittest.TestCase):
    def setUp(self):
        artifacts = Path(__file__).resolve().parents[1] / 'artifacts'
        self.temp = tempfile.TemporaryDirectory(dir=artifacts)
        self.addCleanup(self.temp.cleanup)
        self.output = Path(self.temp.name) / 'delivery'
        self.output.mkdir()
        (self.output / 'Instalar-AEBOT.exe').write_bytes(b'fixture')
        (self.output / 'full.aebot-update').write_bytes(b'fixture')

    def test_guides_and_final_zip_have_only_public_expected_files(self):
        refresh_guides(self.output)
        zip_delivery(self.output)
        with zipfile.ZipFile(self.output.with_name('delivery.zip')) as bundle:
            self.assertIsNone(bundle.testzip())
            self.assertEqual(len(bundle.namelist()), 8)
            self.assertIn('delivery/00-COMECE-AQUI.txt', bundle.namelist())
        with self.assertRaises(ValueError):
            refresh_guides(self.output)

    def test_private_file_is_not_added_to_manifest(self):
        (self.output / 'private.pem').write_bytes(b'fixture')
        with self.assertRaises(ValueError):
            refresh_guides(self.output)
        self.assertFalse((self.output / 'SHA256SUMS.txt').exists())

    def test_changed_file_prevents_zip(self):
        refresh_guides(self.output)
        (self.output / 'Instalar-AEBOT.exe').write_bytes(b'changed')
        with self.assertRaises(ValueError):
            zip_delivery(self.output)
        self.assertFalse(self.output.with_name('delivery.zip').exists())

    def test_extra_or_missing_file_prevents_zip(self):
        refresh_guides(self.output)
        (self.output / 'unexpected.txt').write_text('fixture')
        with self.assertRaises(ValueError):
            zip_delivery(self.output)
