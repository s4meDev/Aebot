from pathlib import Path
import unittest
from zip_app import archive_path_for


class PackageTests(unittest.TestCase):
    def test_zip_keeps_full_version(self):
        self.assertEqual(archive_path_for(Path('dist/AEBOT-Python-0.1.1')),
            Path('dist/AEBOT-Python-0.1.1.zip'))
