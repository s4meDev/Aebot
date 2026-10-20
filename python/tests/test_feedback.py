"""Feedback só existe após envio explícito; importar nunca muda as regras."""
from pathlib import Path
import json
import tempfile
import unittest
import uuid
from unittest.mock import patch
from aebot.feedback import FeedbackStore, FIELDS, validate_feedback


class FeedbackTests(unittest.TestCase):
    def setUp(self):
        directory = Path(__file__).resolve().parents[1] / 'artifacts'
        directory.mkdir(exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=directory)
        self.root = Path(self.temporary.name)
        self.store = FeedbackStore(self.root / 'analyst')

    def tearDown(self):
        self.temporary.cleanup()

    def save(self, store=None, description='Não entendeu a descrição que escrevi.'):
        return (store or self.store).save(service_id='service-example', service_name='Serviço de teste',
            app_version='0.3.0', base_version='2.18.0', category='Não entendeu o relato',
            description=description, expected_response='A orientação esperada foi descrita pelo analista.')

    def test_reading_empty_feedback_does_not_create_a_database(self):
        self.assertEqual(self.store.list(), [])
        self.assertFalse(self.store.path.exists())
        self.assertFalse(self.store.path.parent.exists())

    def test_save_persists_only_explicit_form_fields(self):
        item = self.save()
        self.assertEqual(set(item), set(FIELDS))
        self.assertEqual(FeedbackStore(self.root / 'analyst').list(), [item])
        for field in ('query', 'answer', 'history', 'token', 'analysisCount', 'durationMs'):
            self.assertNotIn(field, item)

    def test_blank_and_oversized_feedback_do_not_create_records(self):
        for value in (' ', 'x' * 6001):
            with self.assertRaises(ValueError):
                self.save(description=value)
        self.assertEqual(self.store.list(), [])

    def test_export_import_and_duplicate_import(self):
        record = self.save()
        destination = self.root / 'export.json'
        self.assertEqual(self.store.export_file(destination), 1)
        manager = FeedbackStore(self.root / 'manager')
        self.assertEqual(manager.import_file(destination), 1)
        self.assertEqual(manager.import_file(destination), 0)
        self.assertEqual(manager.list(), [record])

    def test_conflicting_import_is_atomic(self):
        item = self.save()
        fresh = dict(item, id=str(uuid.uuid4()), description='Novo registro válido.')
        changed = dict(item, description='Mesmo ID, outro conteúdo.')
        source = self.root / 'conflict.json'
        source.write_text(json.dumps(dict(format='aebot-feedback', version=1, feedback=[fresh, changed])), encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'mesmo ID'):
            self.store.import_file(source)
        self.assertEqual(self.store.list(), [item])

    def test_unknown_fields_are_rejected_before_any_write(self):
        item = self.save()
        bad = dict(item, id=str(uuid.uuid4()), history='O chat não pode entrar aqui.')
        source = self.root / 'bad.json'
        source.write_text(json.dumps(dict(format='aebot-feedback', version=1, feedback=[bad])), encoding='utf-8')
        with self.assertRaises(ValueError):
            self.store.import_file(source)
        self.assertEqual(len(self.store.list()), 1)

    def test_local_feedback_is_not_a_destination_for_json_export(self):
        item = self.save()
        with self.assertRaises(ValueError):
            self.store.export_file(self.store.path)
        self.assertEqual(self.store.list(), [item])

    def test_dates_are_normalized_before_showing_utc(self):
        item = self.save()
        record = validate_feedback(dict(item, createdAt='2026-10-20T08:00:00-03:00'))
        self.assertEqual(record['createdAt'], '2026-10-20T11:00:00+00:00')

    def test_import_cannot_execute_text(self):
        item = self.save(description='<script>alert("texto, não código")</script>')
        self.assertEqual(self.store.list()[0]['description'], item['description'])

    def test_invalid_file_version_and_duplicate_ids(self):
        item = self.save()
        source = self.root / 'invalid.json'
        for version, records in [(True, [item]), (2, [item]), (1, [item, item])]:
            source.write_text(json.dumps(dict(format='aebot-feedback', version=version, feedback=records)), encoding='utf-8')
            with self.assertRaises(ValueError):
                self.store.import_file(source)

    def test_export_can_replace_an_export_without_damaging_database(self):
        self.save()
        destination = self.root / 'export.json'
        destination.write_text('exportação antiga', encoding='utf-8')
        self.store.export_file(destination)
        self.assertEqual(len(json.loads(destination.read_text(encoding='utf-8'))['feedback']), 1)
        self.assertFalse(list(self.root.glob('.aebot-feedback-*.tmp')))

    def test_export_does_not_create_a_file_that_cannot_be_imported(self):
        record = self.save()
        destination = self.root / 'large.json'
        with patch('aebot.feedback.MAX_IMPORT_BYTES', 20):
            with self.assertRaisesRegex(ValueError, 'limite de importação'):
                self.store.export_file(destination)
        self.assertFalse(destination.exists())
        self.assertEqual(self.store.list(), [record])
