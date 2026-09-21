# Form Schema

| Step | Field | Type | Required | Options | Reason |
|---|---|---|---|---|---|
| 1 | `first_name` | Text | Yes | N/A | Personalizes the confirmation and identifies the synthetic record |
| 1 | `email` | Email | Yes | Required contact field for CRM contract testing; use synthetic `.invalid` data only |
| 1 | `phone` | Telephone | No | N/A | Optional because a phone number is not needed to demonstrate fit |
| 2 | `service` | Select | Yes | Monthly bookkeeping; Cleanup or catch-up; Accounts payable or receivable; KPI dashboards or consulting; Not sure yet | Routes the enquiry by the visitor's starting situation |

The form posts same-origin to `/api/leads`, expects the `receipt-v1` contract, and navigates to `/thank-you.html` only after accepted storage. The honeypot field is not part of the approved CRM schema. The form is conspicuously synthetic-only and does not reuse the real business's production endpoint.
