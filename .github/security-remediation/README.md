# Temporary security remediation transport

This directory stages the locally reviewed, SHA-256-verified security patch for the dedicated `security/crm-sheets-hardening-20260922` branch. A branch-scoped workflow applies the exact patch, regenerates the CRM example from the maintained source, runs the targeted security tests, and commits the actual source changes. It does not deploy a site, read production credentials, change provider accounts, submit live leads, force-push, or modify main. The transport files and temporary workflow are removed from the resulting commit. Normal PR validation remains mandatory before merge.

Base: 76285ea8408556cacb4d94d5db9f66000cf452e6.
