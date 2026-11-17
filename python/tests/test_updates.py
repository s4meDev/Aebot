"""Testo assinatura, reaproveitamento e falhas sem usar o perfil do analista."""
from pathlib import Path
import hashlib
import json
import tempfile
import unittest
from unittest.mock import patch
import zipfile
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from create_update import create_update
from aebot.updates import (RECEIPT, SIGNATURE, UpdateError, apply_update, current_directory,
    inspect_update, read_inventory, read_state, rollback, signed_release, update_lock, relative_path, version)

ARTIFACTS = Path(__file__).resolve().parents[1] / 'artifacts'


def fixture(directory, number, executable=b'app', launcher=True):
    directory.mkdir()
    files = {'AEBOT.exe': executable, 'LEIA-ME.txt': f'AEBOT - protótipo Python {number} / teste'.encode(),
             'resources/model.bin': b'modelo local sem alteracao' * 100}
    if launcher:
        files['Abrir-AEBOT.exe'] = b'launcher'
    for name, value in files.items():
        target = directory / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(value)
    lines = [hashlib.sha256(value).hexdigest() + '  ' + name for name, value in sorted(files.items())]
    (directory / 'SHA256SUMS.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    return directory


class UpdateTests(unittest.TestCase):
    def setUp(self):
        ARTIFACTS.mkdir(exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=ARTIFACTS)
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.base = fixture(self.directory / 'installed', '0.6.3', b'old', launcher=False)
        self.target = fixture(self.directory / 'release', '0.7.0', b'new')
        self.key = Ed25519PrivateKey.generate()
        self.public = self.key.public_key().public_bytes_raw()
        self.archive = self.directory / 'patch.aebot-update'
        create_update(self.base, self.target, self.archive, self.key, notes='Teste sintético de atualização.')
        self.validator_calls = []

    def validate(self, directory):
        self.validator_calls.append(directory)

    def apply(self):
        return apply_update(self.base, self.archive, public_key=self.public, validator=self.validate)

    def test_delta_leaves_the_model_out_of_download(self):
        with zipfile.ZipFile(self.archive) as bundle:
            self.assertNotIn('files/resources/model.bin', bundle.namelist())
        release = inspect_update(self.archive, self.public)
        self.assertEqual(release.data['files']['resources/model.bin']['source'], 'base')

    def test_update_preserves_original_and_profile_then_activates(self):
        profile = self.directory / 'profile'
        profile.mkdir()
        feedback = profile / 'feedback.sqlite3'
        feedback.write_bytes(b'feedback fora da instalacao')
        self.assertEqual(self.apply(), '0.7.0')
        active = current_directory(self.base, self.public)
        self.assertEqual((active / 'AEBOT.exe').read_bytes(), b'new')
        self.assertEqual((self.base / 'AEBOT.exe').read_bytes(), b'old')
        self.assertEqual(feedback.read_bytes(), b'feedback fora da instalacao')
        self.assertEqual((active / 'resources/model.bin').read_bytes(), (self.base / 'resources/model.bin').read_bytes())
        self.assertEqual(len(self.validator_calls), 1)
        self.assertEqual(read_state(self.base)['previous'], '.')

    def test_wrong_key_is_rejected_before_activation(self):
        with self.assertRaises(UpdateError):
            apply_update(self.base, self.archive, public_key=Ed25519PrivateKey.generate().public_key().public_bytes_raw(), validator=self.validate)
        self.assertIsNone(read_state(self.base))
        self.assertFalse(self.validator_calls)

    def test_corrupt_payload_cannot_be_activated(self):
        altered = self.directory / 'corrupt.aebot-update'
        with zipfile.ZipFile(self.archive) as original, zipfile.ZipFile(altered, 'x') as target:
            for name in original.namelist():
                target.writestr(name, b'bad' if name == 'files/AEBOT.exe' else original.read(name))
        with self.assertRaises(UpdateError):
            apply_update(self.base, altered, public_key=self.public, validator=self.validate)
        self.assertIsNone(read_state(self.base))
        self.assertEqual((self.base / 'AEBOT.exe').read_bytes(), b'old')

    def test_changed_local_model_requires_repair_not_silent_use(self):
        (self.base / 'resources/model.bin').write_bytes(b'corrompido')
        with self.assertRaises(UpdateError):
            self.apply()
        self.assertIsNone(read_state(self.base))

    def test_failed_application_test_keeps_old_version(self):
        with self.assertRaises(RuntimeError):
            apply_update(self.base, self.archive, public_key=self.public,
                validator=lambda _: (_ for _ in ()).throw(RuntimeError('falha sintética')))
        self.assertIsNone(read_state(self.base))
        self.assertEqual((self.base / 'AEBOT.exe').read_bytes(), b'old')

    def test_activation_failure_can_be_retried(self):
        with patch('aebot.updates.os.replace', side_effect=OSError('falha sintética')):
            with self.assertRaises(OSError):
                self.apply()
        self.assertIsNone(read_state(self.base))
        self.assertEqual(self.apply(), '0.7.0')
        self.assertEqual(len(self.validator_calls), 2)

    def test_duplicate_update_and_downgrade_are_rejected(self):
        self.apply()
        with self.assertRaises(UpdateError):
            self.apply()
        release = inspect_update(self.archive, self.public)
        data = dict(release.data, toVersion='0.6.2')
        raw = json.dumps(data).encode()
        with self.assertRaises(UpdateError):
            signed_release(raw, self.key.sign(raw), self.public)

    def test_rollback_to_original_keeps_both_copies(self):
        self.apply()
        previous = current_directory(self.base, self.public)
        self.assertEqual(rollback(self.base, self.public), '0.6.3')
        self.assertIsNone(read_state(self.base))
        self.assertTrue(previous.is_dir())
        self.assertEqual(current_directory(self.base, self.public), self.base)

    def test_second_update_and_rollback_use_the_signed_previous_version(self):
        self.apply()
        previous = current_directory(self.base, self.public)
        next_release = fixture(self.directory / 'next', '0.7.1', b'newer')
        next_archive = self.directory / 'next.aebot-update'
        create_update(previous, next_release, next_archive, self.key, notes='Segunda versão sintética.')
        apply_update(self.base, next_archive, public_key=self.public, validator=self.validate)
        self.assertEqual(rollback(self.base, self.public), '0.7.0')
        self.assertEqual(current_directory(self.base, self.public), previous)

    def test_manifest_unknown_fields_and_duplicate_json_fields_fail(self):
        release = inspect_update(self.archive, self.public)
        raw = json.dumps(dict(release.data, unexpected=True)).encode()
        with self.assertRaises(UpdateError):
            signed_release(raw, self.key.sign(raw), self.public)
        raw = b'{"schema":1,"schema":1}'
        with self.assertRaises(UpdateError):
            signed_release(raw, self.key.sign(raw), self.public)

    def test_paths_that_escape_or_collide_on_windows_are_rejected(self):
        for path in ('../AEBOT.exe', '/AEBOT.exe', 'C:/AEBOT.exe', 'files\\AEBOT.exe',
                     'files/NUL.txt', 'files/x.', 'files/x ', 'files//x', '.aebot-updates/../x'):
            with self.subTest(path=path), self.assertRaises(UpdateError):
                relative_path(path)

    def test_unsigned_or_additional_zip_entry_fails(self):
        altered = self.directory / 'extra.aebot-update'
        with zipfile.ZipFile(self.archive) as original, zipfile.ZipFile(altered, 'x') as target:
            for name in original.namelist():
                target.writestr(name, original.read(name))
            target.writestr('files/nao-declarado.txt', 'extra')
        with self.assertRaises(UpdateError):
            inspect_update(altered, self.public)

    def test_symlink_entry_and_oversized_metadata_fail(self):
        altered = self.directory / 'symlink.aebot-update'
        with zipfile.ZipFile(self.archive) as original, zipfile.ZipFile(altered, 'x') as target:
            for name in original.namelist():
                if name == 'files/AEBOT.exe':
                    info = zipfile.ZipInfo(name)
                    info.external_attr = 0o120777 << 16
                    target.writestr(info, original.read(name))
                else:
                    target.writestr(name, original.read(name))
        with self.assertRaises(UpdateError):
            inspect_update(altered, self.public)
        with self.assertRaises(UpdateError):
            signed_release(b' ' * (2 * 1024**2 + 1), b'x' * 64, self.public)

    def test_corrupt_active_version_is_not_opened_silently(self):
        self.apply()
        active = current_directory(self.base, self.public)
        (active / 'AEBOT.exe').write_bytes(b'changed')
        with self.assertRaises(UpdateError):
            current_directory(self.base, self.public)
        self.assertEqual(rollback(self.base, self.public), '0.6.3')
        self.assertEqual(current_directory(self.base, self.public), self.base)

    def test_one_updater_per_installation_and_lock_releases_after_failure(self):
        with update_lock(self.base):
            with self.assertRaises(UpdateError):
                with update_lock(self.base):
                    self.fail('Não pode abrir duas atualizações.')
        with update_lock(self.base):
            pass

    def test_version_requires_three_nonnegative_components(self):
        for value in ('1', '0.7', '../1', '0.7.0-beta', '00.7.0', '-1.7.0'):
            with self.assertRaises(UpdateError):
                version(value)


if __name__ == '__main__':
    unittest.main()
