"""Exercise real orchestration order with isolated, non-executing tool mocks."""
from contextlib import nullcontext
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

SKILL = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL / 'scripts'))
import quickstart


class StopBeforeBrowserWork(Exception):
    pass


class DemoSnapshotOrderTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        for name in ('build/page-copy.json', 'scripts/copy_parity.py', 'scripts/capture-rendered-copy.mjs'):
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('{}')
        for name, value in (
            ('assert_demo', self.root), ('ensure_ready', None),
            ('local_verification_access', ([], 'synthetic-owner')), ('local_env', {}),
            ('demo_server', nullcontext(('http://127.0.0.1:8793', None))),
        ):
            handle = patch.object(quickstart, name, return_value=value)
            handle.start()
            self.addCleanup(handle.stop)

    def commands_until(self, stop, full=True, fail_brand=False):
        commands = []
        def execute(command, *_args, **_kwargs):
            command = [str(value) for value in command]
            commands.append(command)
            if fail_brand and 'scripts/extract_brand.mjs' in command:
                raise ValueError('Synthetic acquisition failure')
            if stop in command:
                raise StopBeforeBrowserWork()
            return ''
        expected = ValueError if fail_brand else StopBeforeBrowserWork
        with patch.object(quickstart, 'run', side_effect=execute), self.assertRaises(expected):
            quickstart.verify_demo(self.root, 'node', full=full)
        return commands

    def test_full_research_precedes_snapshot_and_all_source_bound_qa(self):
        calls = self.commands_until('scripts/measure_funnel.mjs')
        brand = [i for i, command in enumerate(calls) if 'scripts/extract_brand.mjs' in command]
        snapshots = [i for i, command in enumerate(calls) if 'snapshot' in command]
        self.assertEqual(brand, [0])
        self.assertEqual(snapshots, [1])
        for tool in ('scripts/browser-compat.mjs', 'scripts/live-verify.mjs', 'scripts/capture-rendered-copy.mjs'):
            self.assertGreater(next(i for i, command in enumerate(calls) if tool in command), snapshots[0])

    def test_non_full_verification_starts_with_snapshot_without_unneeded_research(self):
        calls = self.commands_until('scripts/capture-rendered-copy.mjs', full=False)
        self.assertIn('snapshot', calls[0])
        self.assertFalse(any('scripts/extract_brand.mjs' in command for command in calls))

    def test_failed_research_cannot_snapshot_or_run_qa(self):
        calls = self.commands_until('scripts/measure_funnel.mjs', fail_brand=True)
        self.assertEqual(len(calls), 1)
        self.assertIn('scripts/extract_brand.mjs', calls[0])


if __name__ == '__main__':
    unittest.main()
