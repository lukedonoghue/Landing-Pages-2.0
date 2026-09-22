"""Portable reference retrieval must not weaken the no-database handoff boundary."""
from pathlib import Path
import json
import shutil
import sys
import tempfile
import unittest

SKILL = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL / 'scripts'))
import check_gates
import copy_library
import demo_project
import portable_handoff
import runtime_context


class PortableReferenceLibraryTests(unittest.TestCase):
    def test_fresh_demo_roundtrip_preserves_reference_search_without_database(self):
        with tempfile.TemporaryDirectory() as temp:
            parent = Path(temp)
            project = demo_project.write_demo_sources(parent / 'project')
            library = project / '.community-builder/references/copy-library'
            self.assertFalse((library / 'library.sqlite3').exists())
            before = check_gates.source_snapshot(project)
            brief = {'sector': 'home improvement', 'offer_type': 'brochure_quote',
                     'audience': 'B2C', 'intent': 'planned_project'}
            expected = copy_library.select(SKILL / 'references/copy-library', brief)
            self.assertTrue(expected)
            self.assertEqual(copy_library.select(library, brief), expected)
            search = copy_library.search(library, 'gutter protection', 5)
            self.assertTrue(search)
            self.assertTrue(all(item['partition'] == 'train' and item['status'] == 'curated' for item in search))
            self.assertEqual(check_gates.source_snapshot(project), before)
            archive = parent / 'source.zip'
            exported = portable_handoff.export_bundle(project, archive, 'Synthetic source fixture', in_progress=True)
            restored = portable_handoff.extract_archive(archive, parent / 'receiver')
            self.assertEqual(exported['source_fingerprint'], restored['source_fingerprint'])
            root = Path(restored['project'])
            self.assertEqual(copy_library.select(root / '.community-builder/references/copy-library', brief), expected)
            manifest = json.loads((root / '.community-builder/runtime-manifest.json').read_text())
            self.assertTrue(all(runtime_context.sha(root / '.community-builder' / name) == digest
                                for name, digest in manifest['files'].items()))

    def test_bundles_omit_database_and_journals_but_retain_normalized_records(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); source = root / 'skill'; project = root / 'project'
            (source / 'scripts').mkdir(parents=True); project.mkdir()
            (source / 'SKILL.md').write_text('Synthetic skill')
            (source / 'scripts/guide.py').write_text('# Synthetic helper')
            library = source / 'references/copy-library'; library.mkdir(parents=True)
            for name in ('library.sqlite3', 'library.sqlite3-wal', 'library.sqlite3-shm',
                         'library.sqlite3-journal', 'customer.db', 'other.sqlite'):
                (library / name).write_bytes(b'SQLite format 3\x00private fixture')
            (library / 'sources.jsonl').write_text('{}\n')
            bundled = runtime_context.bundle_runtime(source, project)
            self.assertEqual([p.name for p in (bundled / 'references/copy-library').iterdir()], ['sources.jsonl'])

    def test_handoff_still_rejects_databases_even_in_the_reference_directory(self):
        for name in ('public/leads.sqlite3', '.community-builder/references/copy-library/library.sqlite3',
                     '.community-builder/references/copy-library/library.sqlite3-wal'):
            with self.subTest(name=name), self.assertRaises(ValueError):
                portable_handoff.check_data(name, b'SQLite format 3\x00private fixture')
        with self.assertRaisesRegex(ValueError, 'database content'):
            portable_handoff.check_data('public/innocent.txt', b'SQLite format 3\x00private fixture')

    def test_missing_normalized_source_fails_instead_of_inventing_examples(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaises(FileNotFoundError):
                copy_library.select(Path(temp), {})
            self.assertEqual(list(Path(temp).iterdir()), [])


if __name__ == '__main__':
    unittest.main()
