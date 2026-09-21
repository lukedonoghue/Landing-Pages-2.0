# Domain and owner handoff

Read when publishing to an owner-supplied domain or testing owner access. Complete available authorized setup yourself; leave only registrar login, ownership verification, external DNS changes without access, and genuine destination choices to the owner. A researched business URL is not evidence that the user owns its domain.

## Required blocker handoff

Accept the root domain and hostnames already in the request. Do not ask the user to repeat them or infer them from the researched business. At local final, proactively send the preview and any external blockers with instructions. Do not wait for a status request, supervising agent or another failed deployment. Continue unaffected authorized work; pause only actions dependent on the missing input. At final handoff, repeat only unresolved actions and label temporary deployment separately from the requested destination.

For each blocker give: affected feature and current state; evidence and time checked; work already completed; the smallest owner action; numbered steps naming the website, screen, setting, exact verified value when available and expected result; what must not be changed; and what the agent will verify/resume after the owner replies. Ask for confirmation of completion, not passwords, tokens or recovery codes. Mention email and advertising blockers separately from domain setup. For email, reuse the short owner checklist and exact Free-plan paths in [team-access.md](team-access.md#one-time-security-setup); do not duplicate a second setup manual in the handoff. State that the page and CRM can operate on workers.dev without a custom app domain, while sending still needs an authorized owned sender domain. Each recipient, including a teammate on Gmail or any other domain, must be Cloudflare-verified; it does not need to match the sender or company domain. Do not offer paid sending, arbitrary recipients or an invented sender, and do not describe a CLI-assisted reset as working self-service email recovery.

Research registrar identity through registry/registrar RDAP and authoritative DNS through NS/SOA. Follow the registry referral when needed. Nameservers alone identify the DNS provider, not the registrar. Link the current provider's official setup help. If lookup is unavailable or ambiguous, say "unverified" and give the owner a precise way to identify their domain dashboard. Do not manufacture provider-specific navigation.

For the standard Free-plan Cloudflare path, instructions must explain that domain registration and the existing website can stay where they are while authoritative DNS changes. Before asking for that change, inventory the existing zone, including mail and verification records; public DNS is not a full zone export. Reconcile imported records, check DNSSEC/DS, and obtain specific authorization for the nameserver switch. Do not automatically migrate the whole zone just because a user requested two subdomains. If authorized and accessible, prepare the free zone and read its actual assigned nameservers yourself. Never supply sample nameservers as real values. When access/approval is missing, give those prerequisite steps first and explicitly say not to switch nameservers yet. After prerequisites, provide the exact values and registrar-specific clicks. Preserve a record of old nameservers and DNSSEC state for recovery.

Example navigation only when Namecheap is verified: sign in to Namecheap in the computer browser, open Domain List, Manage next to the exact domain, then Domain / Nameservers / Custom DNS. Enter only the two nameservers actually assigned to this zone, then save. This is a nameserver change, not an Advanced DNS CNAME to workers.dev. Before using this example, recheck [Namecheap's current instructions](https://www.namecheap.com/support/knowledgebase/article.aspx/767/10/how-to-change-dns-for-a-domain/). Keep unrelated host records and mail intact. Never ask for a registrar transfer, paid plan, or Cloudflare partial setup to satisfy the Free-plan workflow.

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
5. For external authoritative DNS, check the current eligible setup before promising CNAME-only instructions. Standard full setup requires a nameserver change; partial CNAME setup requires an eligible Business/Enterprise plan. Do not buy a plan or migrate the domain automatically. See [full setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/) and [partial setup](https://developers.cloudflare.com/dns/zone-setups/partial-setup/). Offer workers.dev while the owner completes a chosen supported route.
6. If a nameserver change is chosen, inventory/export DNS first, account for DNSSEC/DS, and prepare the zone. Give the owner the exact assigned nameservers and verified registrar-specific steps. DNS scans are not guaranteed complete. For an eligible CNAME/validation flow, give exact provider-issued type, name, target, TTL and proxy setting. Never invent these values. Record what changes, what stays untouched, and how to undo the specific change.
7. After the owner finishes, check authoritative DNS, HTTPS certificate, intended Worker revision, public form, login and CRM on the actual hostnames. DNS propagation or certificate issuance may remain pending; say so. Recheck the main website and mail DNS for accidental changes. A workers.dev test is not proof that custom domains work.

## Two hostnames, one lead database

Attribution is captured at the landing page and committed with the lead to the shared database; it does not depend on an administrator visiting the same browser origin. `go.example.com` and `crm.example.com` are different origins. Do not promise that localStorage/sessionStorage automatically crosses between them.

Keep the public form's `/api/leads` same-origin on `go`. Route both intended hosts to the same authorized site's backend/D1; serve the login/admin surface on `crm` and guard it by host and authentication. Keep session cookies host-only, HttpOnly and Secure; do not broaden them to `.example.com` just to share tracking. Check Origin/CSRF enforcement and redirects without sending passwords, session tokens or click IDs through login URLs. Do not expose the CRM anonymously on either host.

The current starter and guarded publisher validate one origin. Before claiming this two-host target works, implement and regression-test host routing, allowed-host configuration, host-specific health/revision checks, login/logout, protected routes and public receipt-to-CRM correlation on both addresses. Otherwise report the supported single-origin `/login.html` and `/admin/` deployment and name the two-host work as pending. Do not silently substitute it for the user's requested final arrangement.

## Owner access and recovery acceptance

Provide a separate login URL and private credentials outside Git and public artifacts. Test wrong credentials, successful login, anonymous admin rejection, logout/session revocation, re-login, password change and recovery on the isolated demo. Keep an authorized recovery path and the current private credential reference before changing the password.

The bundled "Forgot your password?" text describes a Cloudflare-owner-assisted reset using the account recovery helper. It is not an email reset service. Exercise that actual recovery, verify the new credential works, the old credential fails and old sessions are revoked. Give the owner plain-language recovery steps. Do not report an email reset as tested or display a dead reset link. A self-service email reset requires an authorized sender/provider and single-use expiring tokens, generic responses, rate limiting and revocation tests; never silently add paid email or send to the real business during a demo.

## Attribution acceptance

Retain approved campaign fields in first-touch and latest-touch data through the popup form, retries, thank-you navigation and the stored CRM lead. Check exact synthetic values at the database-backed CRM API, not just in the URL or data layer. Test Google click IDs, Meta FBCLID, Microsoft MSCLKID and supported UTM fields. Keep click IDs opaque; do not hash or reinterpret them. Use clearly synthetic IDs without firing production advertising conversions.

Test denied/revoked consent and DNT/GPC separately: lead delivery still works, but optional attribution follows the privacy contract. Unknown URL parameters and contact data do not become tracking fields automatically. Document supported fields and retention scope; the current browser attribution is tab-scoped and is not a claim of cross-device or indefinite return-visit attribution.
