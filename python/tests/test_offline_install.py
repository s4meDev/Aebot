"""Confiro a primeira instalação sem usar a conta nem o perfil do analista."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from aebot.updates import UpdateError, inspect_update, install_full
from create_update import create_update
from offline_install import OfflinePayload, OfflineSetup
from test_updates import fixture, ARTIFACTS


class OfflineInstallTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=ARTIFACTS)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).absolute()
        target = fixture(self.root / 'release', '0.9.1')
        key = Ed25519PrivateKey.generate()
        self.public = key.public_key().public_bytes_raw()
        self.archive = self.root / 'full.aebot-update'
        create_update(None, target, self.archive, key, notes='Instalação sintética.')
        self.metadata = dict(version='0.9.1', filename=self.archive.name,
            sha256=hashlib.sha256(self.archive.read_bytes()).hexdigest(), size=self.archive.stat().st_size)
        self.setup = OfflineSetup(self.root, OfflinePayload.read(json.dumps(self.metadata).encode()))
        self.destination = self.root / 'installed'
        self.patches = [patch('offline_install.inspect_update', side_effect=lambda p: inspect_update(p, self.public)),
            patch('offline_install.install_full', side_effect=lambda dest, p, **kw: install_full(dest, p, public_key=self.public, **kw))]
        for context in self.patches:
            context.start()
            self.addCleanup(context.stop)

    def test_installation_is_validated_before_final_directory_exists(self):
        checked = []
        def validator(directory):
            self.assertFalse(self.destination.exists())
            self.assertEqual((directory / 'AEBOT.exe').read_bytes(), b'app')
            checked.append(directory)
        self.assertEqual(self.setup.install(self.destination, validator=validator), '0.9.1')
        self.assertEqual(len(checked), 1)
        self.assertTrue((self.destination / 'Abrir-AEBOT.exe').is_file())

    def test_existing_directory_and_feedback_are_preserved(self):
        self.destination.mkdir()
        feedback = self.destination / 'feedback.sqlite3'
        feedback.write_bytes(b'preservar')
        with self.assertRaises(UpdateError):
            self.setup.install(self.destination, validator=lambda p: None)
        self.assertEqual(feedback.read_bytes(), b'preservar')

    def test_corruption_rejected_before_destination_is_created(self):
        with self.archive.open('ab') as stream:
            stream.write(b'corrompido')
        with self.assertRaises(UpdateError):
            self.setup.install(self.destination, validator=lambda p: None)
        self.assertFalse(self.destination.exists())

    def test_same_size_corruption_is_also_rejected(self):
        raw = self.archive.read_bytes()
        self.archive.write_bytes(bytes([raw[0] ^ 1]) + raw[1:])
        with self.assertRaises(UpdateError):
            self.setup.checked_package()

    def test_missing_payload_explains_full_extraction(self):
        self.archive.rename(self.root / 'preserved.aebot-update')
        with self.assertRaisesRegex(UpdateError, 'Extraia todo o ZIP'):
            self.setup.checked_package()

    def test_wrong_target_version_is_rejected(self):
        self.setup = OfflineSetup(self.root, OfflinePayload.read(json.dumps(dict(self.metadata, version='0.9.2')).encode()))
        with self.assertRaises(UpdateError):
            self.setup.checked_package()

    def test_invalid_signature_cannot_reach_installation(self):
        with patch('offline_install.inspect_update', side_effect=UpdateError('Assinatura inválida')):
            with self.assertRaises(UpdateError):
                self.setup.install(self.destination, validator=lambda p: None)
        self.assertFalse(self.destination.exists())

    def test_validation_failure_does_not_publish_installation(self):
        def fail(directory):
            raise RuntimeError('Falha técnica sintética')
        with self.assertRaises(RuntimeError):
            self.setup.install(self.destination, validator=fail)
        self.assertFalse(self.destination.exists())
        self.assertEqual(len(list(self.root.glob('installed.install-*'))), 1)

    def test_invalid_or_private_path_in_metadata_is_rejected(self):
        for name in ('../full.aebot-update', '.aebot-private/key.aebot-update', 'sub/full.aebot-update'):
            with self.subTest(name=name), self.assertRaises(UpdateError):
                OfflinePayload.read(json.dumps(dict(self.metadata, filename=name)).encode())
        for changes in ({'size': True}, {'sha256': 'bad'}, {'unknown': 'value'}, {'version': None}):
            with self.subTest(changes=changes), self.assertRaises(UpdateError):
                OfflinePayload.read(json.dumps(dict(self.metadata, **changes)).encode())

    def test_relative_or_network_destination_is_rejected(self):
        for path in (Path('relative'), Path('\\\\server\\share\\AEBOT')):
            with self.subTest(path=path), self.assertRaises(UpdateError):
                self.setup.install(path, validator=lambda p: None)
