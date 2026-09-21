# Domain and owner handoff

Read when publishing to an owner-supplied domain or testing owner access. Complete available authorized setup yourself; leave only registrar login, ownership verification, external DNS changes without access, and genuine destination choices to the owner. A researched business URL is not evidence that the user owns its domain.

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
