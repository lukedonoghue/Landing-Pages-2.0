# Domain and owner handoff

Read when publishing to an owner-supplied domain or testing owner access. Complete available authorized setup yourself; leave only registrar login, ownership verification, external DNS changes without access, and genuine destination choices to the owner. A researched business URL is not evidence that the user owns its domain.

## Required blocker handoff

Accept the root domain and hostnames already in the request. Do not ask the user to repeat them or infer them from the researched business. At local final, proactively send the preview and any external blockers with instructions. Do not wait for a status request, supervising agent or another failed deployment. Continue unaffected authorized work; pause only actions dependent on the missing input. At final handoff, repeat only unresolved actions and label temporary deployment separately from the requested destination.

For each blocker give: affected feature and current state; evidence and time checked; work already completed; the smallest owner action; numbered steps naming the website, screen, setting, exact verified value when available and expected result; what must not be changed; and what the agent will verify/resume after the owner replies. Ask for confirmation of completion, not passwords, tokens or recovery codes. Mention optional automatic email and advertising blockers separately from domain setup. For account access, reuse the short owner checklist in [team-access.md](team-access.md#one-time-security-setup); do not duplicate a second setup manual in the handoff. State that the page and CRM can operate on workers.dev without a custom app domain and that manual one-use links work with Gmail or any other inbox without an owned sender domain. Only optional automatic Cloudflare delivery needs an authorized sender domain and Cloudflare-verified recipients. Do not offer paid sending, arbitrary automatic recipients or an invented sender, and do not describe a CLI-assisted reset as working self-service recovery.

Research registrar identity through registry/registrar RDAP and authoritative DNS through NS/SOA. Follow the registry referral when needed. Nameservers alone identify the DNS provider, not the registrar. Link the current provider's official setup help. If lookup is unavailable or ambiguous, say "unverified" and give the owner a precise way to identify their domain dashboard. Do not manufacture provider-specific navigation.

## Choose hosting around the customer's DNS

Keep domain registration, authoritative DNS, the main website and mail where they are by default. A request for two subdomains is not a request to onboard the root zone or change nameservers. Decide this before provisioning, not after treating a Worker Custom Domain permission error as a customer blocker.

- **DNS already on Cloudflare in the authorized account:** the existing Worker Custom Domain path is available. Inspect conflicting records first, preserve unrelated services, and verify both hosts after configuration.
- **DNS stays at Namecheap or another external provider:** use the [external DNS Pages gateway](external-dns-gateway.md). Pages supports custom subdomains through external CNAME records without adding the root as a Cloudflare zone. Keep the maintained Worker/CRM/D1 backend; the gateway forwards original requests through a service binding. Create the Pages project and associate both exact custom hosts in Cloudflare first. Obtain the actual project-provided `pages.dev` target; never invent it or give a CNAME to `workers.dev`. Then give the customer only the necessary records at their existing DNS provider. Do not call pending host verification live.
- **Apex domain or explicitly requested DNS migration:** explain the separate requirements and obtain explicit migration approval. Only this path needs a whole-zone inventory, imported-record reconciliation, DNSSEC/DS review and actual Cloudflare-assigned nameservers. Do not choose this path merely because the existing implementation assumes Workers Custom Domains.

For external DNS, give a compact table with Type, Host, Target and TTL, followed by verified provider clicks. For Namecheap: Domain List > Manage > Advanced DNS > Host Records > Add New Record; use CNAME, `go`/`crm` as the Host labels for those requested subdomains, the verified Pages hostname as Value, and Automatic TTL. Preserve root/www/MX/TXT records and nameservers. Inspect an existing record on either requested label before asking the owner to replace it. After the owner saves, recheck authoritative CNAME answers, Cloudflare custom-domain status and certificates, then execute page/CRM/attribution/login checks on the actual hosts. The agent handles Cloudflare registration and confirmation; the owner handles only external DNS changes for which the agent lacks authorized access.

Automatic email setup is separate from website CNAMEs. Free Cloudflare automatic delivery needs an owned sender domain onboarded to its email service; two Pages CNAMEs do not satisfy that prerequisite. This is optional because manual secure links remain available. Do not quietly migrate the customer's DNS or enable paid sending. Explain the separate sender-domain option only when the owner requests automatic delivery, and obtain any additional setup approval.

For an explicitly authorized migration only, check provider-dependent forwarding/redirect services as well as records. Namecheap Free Email Forwarding depends on its supported DNS service; copying MX records does not establish continuity. Preserve active destinations and retain the old nameservers and DNSSEC state for recovery.

Verified 2026-09-22: [Cloudflare Pages external subdomains](https://developers.cloudflare.com/pages/configuration/custom-domains/#add-a-custom-subdomain), [Pages service bindings](https://developers.cloudflare.com/pages/functions/bindings/#service-bindings). Recheck provider UI labels when needed. Never ask for a registrar transfer or paid partial setup to satisfy this subdomain workflow.

Save a compact `build/owner-handoff.json` alongside the existing status file:

```json
{
  "status": "action_required",
  "message": "The local page is ready. Your requested domain still needs setup. Here are the steps...",
  "domains": [{
    "hostname": "go.example.com",
    "status": "blocked",
    "registrar": {"name": "unverified", "evidence": "RDAP lookup unavailable at the recorded time"},
    "dns_provider": {"name": "Provider from authoritative NS", "evidence": "NS response and time"},
    "blocker_id": "domain-setup"
  }],
  "blockers": [{
    "id": "domain-setup",
    "feature": "Requested custom domains",
    "evidence": "Exact observed prerequisite and time",
    "completed": "Local page and CRM checks completed",
    "steps": [{"action": "Concrete numbered owner action with verified settings or prerequisite", "expected": "Observable result"}],
    "preserve": "Existing website, email DNS and unrelated records",
    "resume": "Check zone activation, attach both hosts, then verify HTTPS, form and CRM"
  }]
}
```

Include every requested hostname and unresolved selected integration. For a verified domain, set its status to `verified` and include `verification` describing actual DNS, HTTPS and app checks; do not infer it from local host-routing tests. For a user-deferred domain use `deferred`, with `decision` quoting that actual choice. No domains requested means an empty domains list. With no blockers use `status: complete`; otherwise use `action_required` and send the numbered instructions in `message`. Use real observations, not this example's text.

When synthetic-contact cleanup is relevant, add a structured disposition. For verified soft-removal, cite the actual retained guarded live report and include the exact plain owner note in `message`:

```json
"cleanup": {
  "disposition": "verified_soft_removed",
  "report": "build/releases/ACTUAL_RELEASE/package/build/live/001/result.json",
  "historical_metrics": "retained",
  "owner_note": "The synthetic contact was soft-removed after verification. Its test visit/conversion remains in historical metrics, so this is not complete erasure."
}
```

Never copy the report placeholder. For unfinished or intentionally retained cleanup, use `pending` or `retained` with a truthful `owner_note`, and omit `report` and `historical_metrics` unless they are applicable. Preserve the owner's wording, but do not label either state verified. Omit the object when cleanup is irrelevant. A retained-contact report cannot support `verified_soft_removed`. Run `python3 <skill>/scripts/validate_owner_handoff.py <project> --hostname go.example.com --hostname crm.example.com`, replacing the flags with every hostname from the actual user request (omit flags when none were requested), before final delivery and send the message contents to the user. Passing the helper validates handoff structure and cited cleanup evidence only; never claim it proves delivery, provider identity, DNS or other live behavior.

## Choose the actual DNS path

1. Confirm the owned root domain and intended hostnames. `go.example.com` for paid traffic and `crm.example.com` for the owner are a supported architectural target, not a claim that the current single-origin starter already separates hosts.
2. Look up public RDAP/registry data and authoritative NS records. Report registrar and DNS host separately with evidence; a CDN, web host or nameserver label does not prove registrar identity. If privacy or a reseller prevents identification, ask the owner where they manage the domain.
3. Inspect the selected Cloudflare account/zone and existing DNS records. Preserve the root website, mail MX/SPF/DKIM/DMARC, verification TXT records and unrelated services. Do not overwrite an existing `go` or `crm` hostname without explicit replacement approval.
4. For an active Cloudflare zone, configure the Worker Custom Domain using the exact hostname. Cloudflare manages its routing DNS and certificate. An existing CNAME on that hostname conflicts with this flow; do not invent a CNAME to workers.dev or delete a conflicting record silently. See [Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).
5. For subdomains whose authoritative DNS remains at Namecheap or another external provider, use the Pages gateway. Create the Pages project, associate both requested hosts, obtain its exact production `pages.dev` hostname, and give the owner only the exact CNAME records. This path does not require a nameserver change or a paid partial-zone plan. Record the existing values at those exact labels before replacement, and leave the apex, nameservers, mail and unrelated records untouched.
6. Use a whole-zone/full-setup migration only for an apex requirement or when the owner explicitly requests it. Before a chosen migration, inventory/export DNS, account for DNSSEC/DS, and prepare the zone. Give the owner the exact assigned nameservers and verified registrar-specific steps. DNS scans are not guaranteed complete. Never invent provider values. Record what changes, what stays untouched, and how to undo the specific change.
7. After the owner finishes, check authoritative DNS, HTTPS certificate, intended Worker revision, public form, login and CRM on the actual hostnames. DNS propagation or certificate issuance may remain pending; say so. Recheck the main website and mail DNS for accidental changes. A workers.dev test is not proof that custom domains work.

## Two hostnames, one lead database

Attribution is captured at the landing page and committed with the lead to the shared database; it does not depend on an administrator visiting the same browser origin. `go.example.com` and `crm.example.com` are different origins. Do not promise that localStorage/sessionStorage automatically crosses between them.

Keep the public form's `/api/leads` same-origin on `go`. Route both intended hosts to the same authorized site's backend/D1; serve the login/admin surface on `crm` and guard it by host and authentication. Keep session cookies host-only, HttpOnly and Secure; do not broaden them to `.example.com` just to share tracking. Check Origin/CSRF enforcement and redirects without sending passwords, session tokens or click IDs through login URLs. Do not expose the CRM anonymously on either host.

The maintained Worker supports distinct `requested_hosts.public` and `requested_hosts.crm` through its generated site configuration. Reuse that routing rather than rewriting it. The guarded release journey still uses one origin, so it is not proof of the requested two-host target: also verify host-specific health/revision checks, login/logout, protected routes and public receipt-to-CRM correlation on both actual addresses. Until both hosts resolve with HTTPS, retain the supported single-origin `/login.html` and `/admin/` fallback and name the two-host work as pending. Do not silently substitute it for the user's requested final arrangement.

## Owner access and recovery acceptance

Provide a separate login URL and private credentials outside Git and public artifacts. Test wrong credentials, successful login, anonymous admin rejection, logout/session revocation, re-login, password change and recovery on the isolated demo. Keep an authorized recovery path and the current private credential reference before changing the password.

The bundled "Forgot your password?" flow records an Admin-approved reset request against the confirmed registered account email; it is not an instant self-service reset. In manual mode, the approving Admin receives a one-use link to send through their normal email account. In automatic mode, Cloudflare sends it. Follow [team access](team-access.md#invitations-and-recovery) for the implemented workflow and its separate Cloudflare-owner recovery backstop when the only Admin is locked out. Exercise the appropriate authorized recovery, verify the new credential works, the old credential fails and old sessions are revoked. Give the owner plain-language steps and distinguish a tested CLI backstop from a tested manual or automatic reset. Never silently add paid email or send to the real business during a demo.

## Attribution acceptance

Retain approved campaign fields in first-touch and latest-touch data through the popup form, retries, thank-you navigation and the stored CRM lead. Check exact synthetic values at the database-backed CRM API, not just in the URL or data layer. Test Google click IDs, Meta FBCLID, Microsoft MSCLKID and supported UTM fields. Keep click IDs opaque; do not hash or reinterpret them. Use clearly synthetic IDs without firing production advertising conversions.

Test denied/revoked consent and DNT/GPC separately: lead delivery still works, but optional attribution follows the privacy contract. Unknown URL parameters and contact data do not become tracking fields automatically. Document supported fields and retention scope; the current browser attribution is tab-scoped and is not a claim of cross-device or indefinite return-visit attribution.
