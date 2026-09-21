# Tracking And Enhanced Conversions

## Current state

Visitor analytics, advertising customer data, advertising pixels, GTM loading, and the consent UI are disabled. First-party lead attribution is enabled only for this synthetic demonstration: the approved 16-field campaign allowlist is stored with a submitted test enquiry as first-touch and latest-touch context. Unknown query parameters are excluded, and GPC/DNT disables capture. No ad account is activated and no attribution or contact data is sent to an advertising platform.

This limited first-party mode still requires accurate disclosure, purpose and lawful-basis review, retention rules, access controls, and a process for applicable privacy requests before any live use with real people. It is not a statement that the operator has no privacy obligations.

A live GTM import was not generated because the required real destination values are absent: GTM container ID, Google Ads conversion ID, and Google Ads conversion label. The builder validates those identifiers; synthetic values may be used only for the explicit offline draft check below and must never be represented as live destinations.

## Offline CLI validation draft - not live

The following exact command uses reserved synthetic labels and an `example.invalid` hostname. Its output is a local syntax/import-structure draft only. Do not import, publish, or use it as evidence of a configured destination.

```sh
python3 scripts/build_gtm_container.py \
  --gtm-id GTM-SYNTHETIC \
  --google-ads-id 0000000000 \
  --google-ads-label SYNTHETIC_DRAFT_NOT_LIVE \
  --action-name "Synthetic Draft - Not Live" \
  --client-name "SYNTHETIC DRAFT - NOT LIVE" \
  --hostname attribution-verification.example.invalid \
  --output build/gtm-container.synthetic-draft-not-live.json
```

## Supported activation path

After the owner supplies the real IDs and selects/configures an external consent provider, update `funnel.json`, run `npm run configure`, replace every synthetic value in the draft command with the reviewed real destination value, change the output name to `build/gtm-container.json`, and run the helper again. The supported output flag is `--output`.

Enhanced conversion mode may be enabled only after lawful-basis review and current-page consent. The supported event order is `customer_data_ready` followed by `lead_accepted`; only provider-normalized SHA-256 values may enter the customer-data event, while `lead_accepted` uses the confirmed CRM receipt for deduplication. Raw email and phone must not enter analytics, GTM variables, logs, URLs, or QA reports.

## Required live verification

- Import into the intended GTM container without overwriting unrelated objects.
- Confirm the external consent provider controls optional tag loading and that GPC/DNT disables it.
- Confirm one accepted synthetic lead produces one receipt-correlated conversion.
- Confirm denied consent still stores the authorized lead but sends no optional tracking or customer-data event.
- Record destination IDs, test receipt, network evidence, and result without contact data or credentials.
