# netbean.com: Domain Setup Handoff

## Verified and Pending

Checked 21 September 2026: the .com registry identifies **NameCheap, Inc.**, registrar ID 1068, as the registrar. It lists `dns1.registrar-servers.com` and `dns2.registrar-servers.com` as nameservers and reports an unsigned delegation. This supports Namecheap registration and Namecheap DNS hosting as separate facts. Recheck DNSSEC immediately before any migration.

Registry source: https://rdap.verisign.com/com/v1/domain/netbean.com

Builder evidence reports that netbean.com is absent from the connected Cloudflare account. The temporary Worker is live, but go.netbean.com and crm.netbean.com are not attached. I did not modify Cloudflare or DNS during this audit.

**No real Cloudflare-assigned nameserver values have been obtained for this zone. Do not change nameservers yet.** The next prerequisite is authorizing and preparing the full DNS migration, including preserving the existing website and email records.

## The Free-Plan Route

For the selected Workers Custom Domain setup, Cloudflare requires an active zone. Free uses full DNS setup; partial CNAME setup is a Business/Enterprise feature. A guessed CNAME from go/crm to workers.dev is not the supported substitute. Domain registration can remain at Namecheap and the main website can remain with its existing host.

Sources: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/ and https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/ and https://developers.cloudflare.com/dns/zone-setups/partial-setup/

## Steps in Order

1. Confirm that Cloudflare should manage DNS for the whole netbean.com zone while registration stays at Namecheap. This affects more than the two subdomains, so publishing permission alone is not permission to disrupt the existing zone. If the domain already belongs to another intended Cloudflare account, select that account instead.
2. Open your usual computer browser and sign in to Namecheap. Go to **Domain List**, then **Manage** beside **netbean.com**. Do not share your password or two-factor code.
3. Open **Advanced DNS** and preserve the complete existing host-record inventory, email settings and forwarding settings. Include root/www records, MX, SPF, DKIM, DMARC and verification records. Public DNS lookups cannot enumerate the whole zone. Use an export if available or readable screenshots that do not contain account secrets. Save the current nameservers as well.
4. After your migration approval, the agent should add or select **netbean.com** in the intended Cloudflare account on the **Free** zone plan, using available authorized access. If agent access cannot create the zone, open Cloudflare **Domains / Onboard a domain**, enter **netbean.com**, and select Free. Do not buy a plan or transfer the registration.
5. Compare Cloudflare's imported DNS records against the full Namecheap inventory. Add anything missing and preserve email routing. Stop if an existing go or crm record would be replaced without your approval. Do not assume the automatic scan is complete.
6. Check DNSSEC at the registrar and Cloudflare before changing nameservers. If an old DS record is present, follow Cloudflare's migration instructions for the existing DNSSEC configuration. The registry was unsigned at audit time, but that is not permission to skip the recheck.
7. Obtain the **exact two nameservers assigned to this Cloudflare zone**. The agent should return those actual values in the chat. This handoff intentionally does not invent them.
8. Only after steps 5-7 are confirmed, return to Namecheap **Domain List / Manage / Domain / Nameservers**. Choose **Custom DNS**, replace the nameserver list with those exact assigned values, and save. Do not enter them as CNAME records in Advanced DNS. Keep the original record inventory for recovery.
9. Tell the agent the change is saved. The agent should verify public delegation and Cloudflare zone activation rather than relying only on a dashboard screenshot. Propagation can take time; pending is not failed or complete.
10. Once the zone is active, the agent should attach **go.netbean.com** and **crm.netbean.com** to this specific Worker using Worker Custom Domains. Cloudflare should create/manage their routing records and certificates. Preserve the existing main website and mail records.
11. The agent must verify both HTTPS hosts, the correct page/CRM host routing, login/logout, protected routes, form receipt and shared D1 record, PDF delivery, and attribution under the selected configuration. Also recheck root/www and mail DNS against the inventory. Do not call the custom-domain setup complete before those checks pass.

Current Namecheap navigation reference: https://www.namecheap.com/support/knowledgebase/article.aspx/767/10/how-to-change-dns-for-a-domain/

## Separate Blockers

- Domain setup does not activate GTM or enhanced conversions. Real container/conversion IDs and the chosen tracking configuration are still needed.
- Domain setup does not verify an email sender or the owner's recipient address. Invitations and email password recovery remain unavailable until configured and tested.
- First-party campaign capture is disabled in the current page configuration. It needs its own correction and positive test; changing DNS alone will not restore it.

No external changes were performed as part of preparing these instructions.
