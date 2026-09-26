import copy
import importlib.util
from pathlib import Path
import unittest

FILE = Path(__file__).resolve().parents[1] / "scripts/validate_owner_handoff.py"
SPEC = importlib.util.spec_from_file_location("owner_handoff", FILE)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class HandoffTests(unittest.TestCase):
    def setUp(self):
        self.data = {"status": "action_required", "message": "Local ready. 1. Open your domain dashboard.",
                     "domains": [{"hostname": "go.example.com", "status": "blocked",
                                  "registrar": {"name": "unverified", "evidence": "RDAP unavailable"},
                                  "dns_provider": {"name": "Example DNS", "evidence": "NS lookup"},
                                  "blocker_id": "dns"}],
                     "blockers": [{"id": "dns", "feature": "Domain", "evidence": "Zone absent",
                                   "completed": "Local QA", "preserve": "Mail and website", "resume": "Verify DNS/HTTPS",
                                   "steps": [{"action": "Identify registrar in your billing dashboard", "expected": "Registrar confirmed"}]}]}

    def test_actionable_unknown_registrar_allowed(self):
        self.assertEqual([], MODULE.validate(self.data))

    def test_blocker_list_without_steps_rejected(self):
        del self.data["blockers"][0]["steps"]
        self.assertTrue(MODULE.validate(self.data))

    def test_temporary_url_does_not_complete_custom_domain(self):
        self.data["status"] = "complete"
        self.assertTrue(MODULE.validate(self.data))

    def test_registrar_not_inferred_from_dns(self):
        del self.data["domains"][0]["registrar"]
        self.assertTrue(MODULE.validate(self.data))

    def test_missing_owner_action_link_rejected(self):
        self.data["domains"][0]["blocker_id"] = "other"
        self.assertTrue(MODULE.validate(self.data))

    def test_verified_needs_observation(self):
        self.data["domains"][0]["status"] = "verified"
        self.assertTrue(MODULE.validate(self.data))

    def test_defer_requires_user_decision(self):
        self.data["domains"][0]["status"] = "deferred"
        self.assertTrue(MODULE.validate(self.data))
        self.data["domains"][0]["decision"] = "User said keep workers.dev"
        self.assertEqual([], MODULE.validate(self.data))

    def test_no_domain_build(self):
        self.assertEqual([], MODULE.validate({"status": "complete", "message": "Local final", "domains": [], "blockers": []}))

    def test_requested_crm_hostname_cannot_be_omitted(self):
        self.assertTrue(MODULE.validate(self.data, ["go.example.com", "crm.example.com"]))
        self.assertEqual([], MODULE.validate(self.data, ["GO.EXAMPLE.COM."]))

    def test_malformed_fields_fail_cleanly(self):
        for value in (None, [], {"domains": {}}, {"message": 1, "domains": [None], "blockers": [None]}):
            with self.subTest(value=value):
                self.assertTrue(MODULE.validate(copy.deepcopy(value)))


if __name__ == "__main__":
    unittest.main()
