# Advertising tracking and GTM import

Advertising integrations are optional and off by default. They never determine whether an enquiry succeeded.

## Runtime contract

After `POST /api/leads` returns a committed `receipt_id`, the browser may push two ordered events:

1. `customer_data_ready` is pushed only when `tracking.customer_data_mode` is `consent`, the visitor explicitly allowed optional data, browser privacy signals do not opt out, and `tracking.sensitive_category` is false. It contains SHA-256 values only.
2. `lead_accepted` is pushed after the customer-data event and contains the receipt as both `receipt_id` and `transaction_id`, the form name, and permitted campaign identifiers. It never contains contact details.

The customer-data payload is platform-specific because normalization is not identical:

```json
{
  "event": "customer_data_ready",
  "receipt_id": "server receipt",
  "transaction_id": "server receipt",
  "customer_data": {
    "google": {
      "sha256_email_address": "lowercase hex SHA-256",
      "sha256_phone_number": "lowercase hex SHA-256"
    },
    "meta": {"em": "lowercase hex SHA-256", "ph": "lowercase hex SHA-256"},
    "microsoft": {"em": "lowercase hex SHA-256", "ph": "lowercase hex SHA-256"}
  }
}
```

Email is trimmed and lowercased. Google's value also removes dots from the local part for `gmail.com` and `googlemail.com`. Phone punctuation is removed, but a phone is emitted only when the result is already a valid E.164 number beginning with `+`; the page does not guess a country code. Hashing happens in the browser with Web Crypto. Raw email and phone values must never enter `dataLayer`.

Hashing is not a policy exemption. Set `tracking.sensitive_category` to `true` for health, medical, financial-hardship, or other restricted client categories and keep `customer_data_mode` disabled. The configuration synchronizer rejects the unsafe combination. Confirm current platform policy and the client's lawful basis before enabling any customer-data adapter.

## Configuration

Use this shape in `funnel.json`:

```json
{
  "tracking": {
    "gtm": {"container_id": "GTM-XXXXXXX", "hostname": "client.example"},
    "customer_data_mode": "consent",
    "sensitive_category": false,
    "google_ads": {"conversion_id": "10889706069", "conversion_label": "label", "enhanced_conversions": true},
    "meta": {"pixel_id": "123456789012345", "enabled": true},
    "microsoft": {"uet_tag_id": "12345678", "enabled": true}
  }
}
```

Run `npm run configure` so the Worker and browser use the same policy. New builds that enable optional tracking use `privacy.consent_ui: "external"`; connect the provider's current-page decision to `LeadFunnel.setConsent(...)`. Do not fabricate that signal, trust a stale built-in choice while the provider is pending, or inject a custom banner. A valid GTM container loads only after the current external signal allows optional data. Builds with optional tracking disabled use `privacy.consent_ui: "disabled"`, show no choices UI, and never load GTM even if old browser storage says consent was granted. Do not paste a second hardcoded GTM loader into the page.

## Build the import

From a generated project:

```bash
python3 scripts/build_gtm_container.py \
  --gtm-id GTM-XXXXXXX \
  --google-ads-id 10889706069 \
  --google-ads-label REPLACE_WITH_REAL_LABEL \
  --action-name "Submit Lead Form" \
  --hostname client.example \
  --enhanced-conversions \
  --meta-pixel-id 123456789012345 \
  --microsoft-uet-id 12345678 \
  --output build/gtm-container.json
```

The builder validates IDs, object references, raw-contact-data keys, event triggers, and sensitive-category blocking. It generates a full new-container import. For a populated GTM container, export it first and merge only the new objects; do not overwrite existing tags or variables blindly.

Google is the primary template target. Local schema/reference validation does not establish that the current GTM interface accepted the import or that Ads received enhanced-conversion data. Verify the generated Google tag, Conversion Linker, Ads conversion, hashed user-data event, receipt transaction ID and both triggers in the intended container. Meta and Microsoft adapters consume their dedicated hash maps and are included only when their IDs are supplied.

Guide the owner through enabling enhanced conversions and user-provided-data capabilities in the intended Google tag/Ads destination, including their own acceptance of the applicable customer-data terms. An import cannot grant this account-side setting or consent. Follow the current [official Google setup instructions](https://support.google.com/google-ads/answer/13262500?hl=en); do not silently enable automatic raw-field detection when this build's selected contract is explicit browser-hashed data.

## Required live verification

An import is not proof of delivery. In an isolated test destination:

1. Use GTM Preview and confirm `customer_data_ready` precedes `lead_accepted` for one accepted lead.
2. Confirm raw email and phone do not appear in the data layer, GTM variables, advertising/analytics requests, console, or saved QA artifacts. The authorized first-party lead API must receive contact fields to store the enquiry; distinguish that legitimate CRM payload from analytics leakage.
3. Confirm a direct thank-you visit, refresh, rejected lead, denied consent, DNT/GPC session, and repeated receipt produce no duplicate conversion.
4. Confirm Google Ads diagnostics receive user-provided data and one conversion with the receipt transaction ID.
5. Confirm Meta Events Manager/Test Events and Microsoft UET Tag Helper receive exactly one lead. Provider UIs and policies change; these two adapters remain unverified until this destination-specific test is recorded.
6. Record the destination IDs, test receipt, time, screenshots, result, and recovery behavior in the tracking evidence. Remove or clearly label test data.

Never mark B23 complete from local tests alone. Each enabled provider needs a real destination test.
