# Maintained CRM example

Generated from the maintained community skill; never copy an older example over it. Run `python scripts/sync_crm_example.py` at the repository root after changing the template, and `--check` in CI. All checked-in configuration is generic. No client domains, credentials, lead data or production deployments are included.

For secure Google Sheets setup and the required operator rollout, read the skill references `google-sheets.md` and `security-operations.md`. The old token-based connector must be upgraded, not silently enabled. Identity-attribution migrations 0009/0010 from the former example branch remain a separate reviewed feature. Do not deploy an old example branch.
