# Form Schema

One accessible three-step lightbox collects only the information needed to deliver the guide and support a relevant follow-up.

| Step | Field | Type | Required | Options | Reason |
|---|---|---|---|---|---|
| 1 | first_name | text | Yes | — | Personalize the response |
| 1 | last_name | text | Yes | — | Identify the enquiry |
| 1 | email | email | Yes | — | Contact and guide access fallback |
| 1 | phone | tel | Yes | — | Franchise-development follow-up |
| 2 | background | select | Yes | Automotive/dealership; finance/lending/collections; multi-unit franchise; business leadership/entrepreneurship; other | Tailor the initial conversation without asking for sensitive financial details |
| 2 | timeline | select | Yes | Within 6 months; 6–12 months; 12–24 months; researching | Understand evaluation stage |
| 3 | contact_method | select | Yes | Phone; Email | Respect channel preference |

The form does not ask for net worth, liquid capital, address, free-text financial details, uploads, or open-ended comments. Submission goes to same-origin `/api/leads`; success requires a committed receipt. Analytics receives no raw contact data.
