"""Behavioral boundaries for portable local onboarding; no account or cloud access."""
import importlib.util
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch
from datetime import date

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills/branded-lead-funnel-builder"
sys.path.insert(0, str(SKILL / "scripts"))
import runtime_check
import quickstart
from demo_project import assert_demo, seed_sql, write_demo_sources


class OnboardingTests(unittest.TestCase):
    def test_local_verification_uses_recovered_access_and_blocks_another_database(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = write_demo_sources(Path(tmp) / 'demo')
            private = project / '.secrets'; private.mkdir(exist_ok=True)
            config = json.loads((project / 'wrangler.jsonc').read_text())
            credential = private / 'current.json'; credential.write_text(json.dumps({'username': 'new-owner', 'password': 'synthetic-only'}))
            value = {'username': 'new-owner', 'credentials_file': '.secrets/current.json', 'target': {'mode': 'local', 'worker': config['name'], 'database_id': config['d1_databases'][0]['database_id']}}
            reference = private / 'current-local-admin-access.json'; reference.write_text(json.dumps(value))
            args, owner = quickstart.local_verification_access(project)
            self.assertEqual(owner, 'new-owner'); self.assertEqual(args, ['--credentials-file', str(credential.resolve())])
            value['target']['database_id'] = 'another'; reference.write_text(json.dumps(value))
            with self.assertRaisesRegex(ValueError, 'another database'): quickstart.local_verification_access(project)

    def test_demo_reset_preserves_and_retires_old_owner_recovery_state(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = write_demo_sources(Path(tmp) / 'demo')
            private = project / '.secrets'; (private / 'account-recovery/operation').mkdir(parents=True)
            (private / 'account-recovery/operation/state.json').write_text('synthetic retained operation')
            (private / 'journeys/journey').mkdir(parents=True)
            (private / 'journeys/journey/submission.json').write_text('synthetic private request')
            reference = private / 'current-local-admin-access.json'; reference.write_text('synthetic old reference')
            with patch('quickstart.setup_database') as setup:
                result = quickstart.reset_demo(project, 'unused-node')
            saved = Path(result['previous_local_state_preserved'])
            self.assertEqual((saved / 'current-local-admin-access.json').read_text(), 'synthetic old reference')
            self.assertEqual((saved / 'account-recovery/operation/state.json').read_text(), 'synthetic retained operation')
            self.assertFalse(reference.exists()); self.assertFalse((private / 'account-recovery').exists())
            self.assertEqual((saved / 'journeys/journey/submission.json').read_text(), 'synthetic private request')
            self.assertFalse((private / 'journeys').exists())
            setup.assert_called_once()

    def test_local_command_timeout_is_bounded_and_preserves_existing_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            existing=Path(tmp)/'keep.txt';existing.write_text('preserve')
            with self.assertRaisesRegex(ValueError,'time limit'):
                quickstart.run([sys.executable,'-c','import time; time.sleep(60)'],Path(tmp),timeout=0.05)
            self.assertEqual(existing.read_text(),'preserve')

    def test_node_version_boundary(self):
        for version in ["v22.19.0", "v22.20.0", "v24.19.0"]:
            self.assertTrue(runtime_check.supported_node(version))
        for version in ["v20.19.2", "v22.18.0", "", "unknown"]:
            self.assertFalse(runtime_check.supported_node(version))

    def test_missing_tools_are_blocked_without_probing_accounts(self):
        with tempfile.TemporaryDirectory() as tmp, patch("runtime_check.node_path", return_value=None), patch("runtime_check.shutil.which", return_value=None), patch("runtime_check.probe") as probe:
            result = runtime_check.inspect(Path(tmp))
            self.assertEqual(result["status"], "blocked")
            self.assertEqual(result["scope"], "local_build_tools")
            self.assertTrue(all(c["action"] for c in result["checks"] if c["status"] == "missing"))
            probe.assert_not_called()

    def test_skipped_or_incomplete_application_tests_are_not_success(self):
        passed = "# tests 2\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n"
        self.assertEqual(quickstart.parse_node_summary(passed)["pass"], 2)
        for report in [passed.replace("# skipped 0", "# skipped 1"), passed.replace("# pass 2", "# pass 1"), "", "# tests 0\n# pass 0\n# fail 0\n# cancelled 0\n# skipped 0\n"]:
            with self.assertRaises(ValueError):
                quickstart.parse_node_summary(report)

    def test_demo_never_overwrites_existing_work_and_has_consistent_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "project"
            root.mkdir()
            (root / "personal.txt").write_text("keep this")
            with self.assertRaises(ValueError):
                write_demo_sources(root)
            self.assertEqual((root / "personal.txt").read_text(), "keep this")
            project = write_demo_sources(Path(tmp) / "demo")
            self.assertEqual(assert_demo(project), project)
            funnel = json.loads((project / "funnel.json").read_text())
            self.assertIs(funnel["development_fixture"], True)
            self.assertIn('fictional local demonstration', (project / 'START-HERE.md').read_text())
            self.assertNotIn('npm run publish', (project / 'START-HERE.md').read_text())
            self.assertFalse((project / ".github/workflows/deploy.yml").exists())
            fixture = json.loads((project / "test-fixture.json").read_text())
            options = next(x["options"] for x in funnel["form_fields"] if x["name"] == "service")
            self.assertIn(fixture["fields"]["service"], options)
            self.assertIn(fixture["fields"]["service"], (project / "public/index.html").read_text())
            (project / "public/index.html").write_text("manual edit")
            with self.assertRaises(ValueError):
                write_demo_sources(project)
            self.assertEqual((project / "public/index.html").read_text(), "manual edit")

    def test_remote_binding_and_runtime_symlink_disable_demo_operations(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = write_demo_sources(Path(tmp) / "demo")
            config_path = project / "wrangler.jsonc"
            config = json.loads(config_path.read_text())
            config["account_id"] = "not-a-local-account"
            config_path.write_text(json.dumps(config))
            with self.assertRaises(ValueError):
                assert_demo(project)
            config.pop("account_id")
            config_path.write_text(json.dumps(config))
            (project / ".wrangler").symlink_to(Path(tmp) / "outside")
            with self.assertRaises(ValueError):
                assert_demo(project)

    def test_seed_data_has_repeatable_cohorts_without_duplicate_contacts(self):
        db = sqlite3.connect(":memory:")
        for migration in sorted((SKILL / "assets/cloudflare/migrations").glob("*.sql")):
            db.executescript(migration.read_text())
        sql = seed_sql(date(2026, 9, 16))
        db.executescript(sql)
        db.executescript(sql)
        self.assertEqual(db.execute("SELECT COUNT(*) FROM leads").fetchone()[0], 3)
        self.assertEqual(db.execute("SELECT COUNT(*) FROM lead_notifications").fetchone()[0], 3)
        self.assertEqual(db.execute("SELECT COUNT(*) FROM visit_events").fetchone()[0], 9)
        self.assertEqual(db.execute("SELECT COUNT(*) FROM leads l JOIN visit_events v ON l.visit_event_id=v.event_id AND l.visitor_hash=v.visitor_hash AND l.reporting_day=v.reporting_day").fetchone()[0], 3)
        self.assertEqual(db.execute("SELECT COUNT(*) FROM leads WHERE email NOT LIKE '%@example.invalid'").fetchone()[0], 0)
        db.close()

    def test_running_demo_lock_prevents_reset_before_any_database_action(self):
        with tempfile.TemporaryDirectory() as tmp:
            project=write_demo_sources(Path(tmp)/'demo')
            with quickstart.demo_lock(project), patch('quickstart.setup_database') as setup:
                with self.assertRaisesRegex(ValueError,'already in use'):
                    quickstart.reset_demo(project,'unused-node')
                setup.assert_not_called()

    def test_older_demo_without_copy_contract_fails_before_start_or_form_writes(self):
        with tempfile.TemporaryDirectory() as tmp:
            project=write_demo_sources(Path(tmp)/'demo')
            original=(project/'public/index.html').read_bytes()
            (project/'build/page-copy.json').unlink()
            with patch('quickstart.demo_server') as server, patch('quickstart.ensure_ready') as ready:
                with self.assertRaisesRegex(ValueError,'new demo directory'):
                    quickstart.verify_demo(project,'unused-node')
                server.assert_not_called();ready.assert_not_called()
            self.assertEqual((project/'public/index.html').read_bytes(),original)


if __name__ == "__main__":
    unittest.main()
