"""Generated boundary configuration, not proof of installed-host enforcement."""
import importlib.util
import json
from pathlib import Path
import tomllib
import unittest
SCRIPT=Path(__file__).resolve().parents[1]/"scripts/agent_security.py"
spec=importlib.util.spec_from_file_location("security_config_under_test",SCRIPT)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class AgentSecurityTests(unittest.TestCase):
    def test_codex_does_not_inherit_provider_credentials(self):
        config=tomllib.loads(module.codex_config())
        env=config["shell_environment_policy"]
        self.assertEqual(env["inherit"],"core")
        self.assertFalse(env["ignore_default_excludes"])
        self.assertFalse(env["experimental_use_profile"])
        for name in ["CLOUDFLARE_*","GOOGLE_APPLICATION_CREDENTIALS","*PASSWORD*","*SECRET*","*TOKEN*","AWS_*","GH_*","GITHUB_*"]:
            self.assertEqual(env["filters"][name],"exclude")
    def test_all_codex_profiles_keep_file_denials(self):
        config=tomllib.loads(module.codex_config())
        for name in ["lp-build","lp-review"]:
            fs=config["permissions"][name]["filesystem"]
            self.assertEqual(fs["~/.wrangler"],"deny")
            self.assertEqual(fs[":workspace_roots"][".secrets"],"deny")
    def test_claude_requires_sandbox_and_denies_both_password_forms(self):
        config=module.claude_settings()["sandbox"]
        self.assertTrue(config["failIfUnavailable"])
        self.assertFalse(config["allowUnsandboxedCommands"])
        denied={row["name"] for row in config["credentials"]["envVars"] if row["mode"]=="deny"}
        self.assertTrue({"ADMIN_PASSWORD","ADMIN_PASSWORD_HASH","GOOGLE_SHEETS_SIGNING_SECRET"}.issubset(denied))
    def test_checked_in_root_configs_match_generator(self):
        root=SCRIPT.parents[3]
        self.assertEqual(tomllib.loads((root/".codex/config.toml").read_text()),tomllib.loads(module.codex_config()))
        self.assertEqual(json.loads((root/".claude/settings.json").read_text()),module.claude_settings())

if __name__=="__main__":unittest.main()
