import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import workflow


class PublishAuthorizationTests(unittest.TestCase):
    def exercise(self, copy_required=False, copy_blocked=False, gates_blocked=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'funnel.json').write_text(json.dumps({
                'approvals': {'copy_before_design': copy_required}
            }))
            copy = {'status': 'blocked' if copy_blocked else 'pass',
                    'failures': ['Copy is not ready'] if copy_blocked else []}
            gates = {'status': 'blocked' if gates_blocked else 'pass',
                     'source_fingerprint': 'f' * 64,
                     'failures': ['Quality gate failed'] if gates_blocked else []}
            with patch.object(workflow, 'copy_state', return_value=copy) as state, \
                 patch.object(workflow, 'check_copy_approval', return_value=copy) as approval, \
                 patch.object(workflow.check_gates, 'check', return_value=gates), \
                 patch.object(workflow, 'load', return_value={'approvals': {}}), \
                 patch.object(workflow, 'save') as save:
                if copy_blocked or gates_blocked:
                    with self.assertRaises(ValueError):
                        workflow.record(root, 'publish', 'Publish this demo', 'user-message', allow_test_lead=True)
                    save.assert_not_called()
                else:
                    result = workflow.record(root, 'publish', 'Publish this demo', 'user-message', allow_test_lead=True)
                    self.assertEqual(result['status'], 'pass')
                    recorded = save.call_args.args[1]['approvals']['publish']
                    self.assertEqual(recorded['actor'], 'user')
                    self.assertEqual(recorded['message_id'], 'user-message')
                    self.assertEqual(recorded['fingerprint'], 'f' * 64)
                self.assertEqual(approval.call_count, int(copy_required))
                self.assertEqual(state.call_count, int(not copy_required))

    def test_disabled_copy_checkpoint_keeps_publish_permission(self):
        self.exercise()

    def test_enabled_copy_checkpoint_still_requires_approval(self):
        self.exercise(copy_required=True, copy_blocked=True)

    def test_disabled_copy_checkpoint_still_requires_ready_copy(self):
        self.exercise(copy_blocked=True)

    def test_disabled_copy_checkpoint_still_requires_quality_gates(self):
        self.exercise(gates_blocked=True)


if __name__ == '__main__':
    unittest.main()
