"""Testo uma central de laboratório sem acessar a empresa ou pedir login."""
import base64
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from create_update import create_update
from publish_channel import publish
from test_updates import fixture, ARTIFACTS
from aebot.company_source import discover_sources, save_source, source_candidates
from aebot.update_channel import (CATALOG, ChannelRelease, UpdateChannel, canonical, check_sources, fetch_release)
from aebot.updates import (UpdateError, digest, install_full, apply_update, current_directory, installed_version)
from aebot.channel_client import ChannelClient


class ChannelTests(unittest.TestCase):
    def setUp(self):
        ARTIFACTS.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=ARTIFACTS)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.base = fixture(self.root / 'base', '0.7.0', b'old')
        self.target = fixture(self.root / 'target', '0.8.0', b'new')
        self.key = Ed25519PrivateKey.generate()
        self.public = self.key.public_key().public_bytes_raw()
        self.delta = self.root / 'delta.aebot-update'
        self.full = self.root / 'full.aebot-update'
        create_update(self.base, self.target, self.delta, self.key, notes='Delta sintético.')
        create_update(None, self.target, self.full, self.key, notes='Instalação sintética.')
        self.source = self.root / 'AEBOT'
        publish(self.source, [self.delta, self.full], self.key)
        self.basehash = digest(self.base / 'SHA256SUMS.txt')

    def select(self, installed='0.7.0', manifest=None):
        return check_sources([str(self.source)], installed, manifest or self.basehash, self.public)

    def test_company_folder_has_compatible_signed_update(self):
        result = self.select()
        self.assertEqual(result['status'], 'available')
        self.assertEqual(result['release']['kind'], 'delta')
        self.assertEqual(result['latest'], '0.8.0')

    def test_initial_installation_uses_full_package(self):
        result = self.select(installed=None)
        self.assertEqual(result['release']['kind'], 'full')
        cached = fetch_release(str(self.source), result['release'], self.root / 'cache', self.public)
        installed = self.root / 'installed'
        self.assertEqual(install_full(installed, cached, public_key=self.public, validator=lambda _: None), '0.8.0')
        self.assertEqual(installed_version(installed), '0.8.0')

    def test_full_installation_does_not_overwrite_any_existing_directory(self):
        with self.assertRaises(UpdateError):
            install_full(self.base, self.full, public_key=self.public, validator=lambda _: None)
        self.assertEqual((self.base / 'AEBOT.exe').read_bytes(), b'old')

    def test_client_download_then_apply_preserves_original(self):
        result = self.select()
        cache = self.root / 'cache'
        path = fetch_release(str(self.source), result['release'], cache, self.public)
        self.assertEqual(fetch_release(str(self.source), result['release'], cache, self.public), path)
        self.assertEqual(apply_update(self.base, path, public_key=self.public, validator=lambda _: None), '0.8.0')
        self.assertEqual((self.base / 'AEBOT.exe').read_bytes(), b'old')
        self.assertEqual((current_directory(self.base, self.public) / 'AEBOT.exe').read_bytes(), b'new')

    def test_same_and_newer_versions_are_not_downgraded(self):
        for installed in ('0.8.0', '0.8.1', '1.0.0'):
            self.assertEqual(self.select(installed)['status'], 'current')

    def test_wrong_base_has_no_automatic_full_replacement(self):
        self.assertEqual(self.select(manifest='0' * 64)['status'], 'incompatible')
        self.assertEqual(self.select(installed='0.6.3')['status'], 'incompatible')

    def test_missing_folder_is_not_reported_as_up_to_date(self):
        with self.assertRaises(UpdateError):
            check_sources([str(self.root / 'missing')], '0.7.0', self.basehash, self.public)

    def test_missing_discovery_candidate_does_not_hide_the_valid_library(self):
        result = check_sources([str(self.root / 'downloads'), str(self.source)], '0.7.0', self.basehash, self.public)
        self.assertEqual(result['status'], 'available')
        self.assertEqual(result['source'], str(self.source))

    def test_multiple_signed_sources_require_explicit_choice(self):
        other = self.root / 'other/AEBOT'
        publish(other, [self.delta, self.full], self.key)
        with self.assertRaises(UpdateError):
            check_sources([str(self.source), str(other)], '0.7.0', self.basehash, self.public)

    def test_tampered_catalogue_and_unknown_key_are_rejected(self):
        path = self.source / CATALOG
        raw = path.read_bytes()
        data = json.loads(raw)
        data['payload']['latest'] = '9.0.0'
        with self.assertRaises(UpdateError):
            UpdateChannel.verify(canonical(data), self.public)
        with self.assertRaises(UpdateError):
            UpdateChannel.verify(raw, Ed25519PrivateKey.generate().public_key().public_bytes_raw())

    def test_incomplete_sync_and_corrupt_cache_are_rejected(self):
        result = self.select()
        release = ChannelRelease.from_dict(result['release'])
        file = self.source / release.filename
        original = file.read_bytes()
        file.write_bytes(original[:-1])
        with self.assertRaises(UpdateError):
            fetch_release(str(self.source), result['release'], self.root / 'cache', self.public)
        file.write_bytes(original)
        cached = fetch_release(str(self.source), result['release'], self.root / 'cache', self.public)
        cached.write_bytes(b'corrupted')
        with self.assertRaises(UpdateError):
            fetch_release(str(self.source), result['release'], self.root / 'cache', self.public)

    def test_source_location_is_saved_once_outside_the_installation(self):
        storage = self.root / 'settings'
        save_source(storage, str(self.source.absolute()))
        with patch('aebot.company_source.registry_locations', return_value=[]):
            self.assertEqual(source_candidates(storage), [str(self.source.absolute())])
        self.assertFalse((self.base / 'source.json').exists())

    def test_sharepoint_mount_and_shortcut_are_discovered_without_scanning_home(self):
        root = str(self.root / 'library')
        found = discover_sources([(root, 'https://aegeactl.sharepoint.com/sites/analisequalidade/Shared Documents')])
        self.assertIn(str(Path(root) / 'Funcionalidades/AEBOT'), found)
        self.assertEqual(discover_sources([(root, 'https://other.sharepoint.com/sites/other')]), [])

    def test_cancel_before_activation_keeps_current_and_no_initial_install(self):
        with self.assertRaises(UpdateError):
            apply_update(self.base, self.delta, public_key=self.public, validator=lambda _: None, cancelled=lambda: True)
        self.assertEqual(current_directory(self.base, self.public), self.base)
        destination = self.root / 'new'
        with self.assertRaises(UpdateError):
            install_full(destination, self.full, public_key=self.public, validator=lambda _: None, cancelled=lambda: True)
        self.assertFalse(destination.exists())

    def test_bad_publisher_directory_does_not_touch_autoforms(self):
        with self.assertRaises(UpdateError):
            publish(self.root / 'AutoForms', [self.delta], self.key)
        self.assertFalse((self.root / 'AutoForms').exists())

    def test_publisher_rejects_downgrade_before_replacing_public_installer(self):
        path = self.source / CATALOG
        data = json.loads(path.read_bytes())
        data['payload']['latest'] = '9.0.0'
        for release in data['payload']['releases']:
            release['toVersion'] = '9.0.0'
        import base64
        data['signature'] = base64.b64encode(self.key.sign(canonical(data['payload']))).decode()
        path.write_bytes(canonical(data))
        public_installer = self.source / 'Instalar-AEBOT.exe'
        public_installer.write_bytes(b'previous-installer')
        with self.assertRaises(UpdateError):
            publish(self.source, [self.delta, self.full], self.key, installer=self.base / 'AEBOT.exe')
        self.assertEqual(public_installer.read_bytes(), b'previous-installer')

    def test_background_client_has_a_timeout_and_cancellation_for_its_own_child(self):
        import threading
        class Child:
            returncode = None
            killed = False
            def poll(self): return None if not self.killed else -1
            def kill(self): self.killed = True
            def wait(self, timeout): return -1
        child = Child()
        cancel = threading.Event()
        cancel.set()
        client = ChannelClient(self.base, self.root / 'settings')
        with patch('aebot.channel_client.subprocess.Popen', return_value=child):
            with self.assertRaises(UpdateError):
                client._run(dict(operation='check'), cancel, 1)
        self.assertTrue(child.killed)
        self.assertEqual(list((self.root / 'settings/jobs').iterdir()), [])

    def test_timeout_terminates_only_the_child_it_created(self):
        class Child:
            returncode = None
            killed = False
            def poll(self): return None if not self.killed else -1
            def kill(self): self.killed = True
            def wait(self, timeout): return -1
        child = Child()
        client = ChannelClient(self.base, self.root / 'timeout-settings')
        with patch('aebot.channel_client.subprocess.Popen', return_value=child), patch(
                'aebot.channel_client.time.monotonic', side_effect=[0, 2]):
            with self.assertRaises(UpdateError):
                client._run(dict(operation='check'), None, 1)
        self.assertTrue(child.killed)

    def test_downloaded_installer_opens_the_existing_default_installation(self):
        import updater_main
        with patch('sys.argv', ['Instalar-AEBOT.exe']), patch(
                'aebot.company_source.default_install_directory', return_value=self.base), patch(
                'updater_main.launch') as launch:
            updater_main.main()
        launch.assert_called_once_with(self.base)


if __name__ == '__main__':
    unittest.main()
