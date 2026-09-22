/* A direct page visit is not an accepted lead and must not fire a conversion. */
(() => {
  const apply = () => {
    let receipt;
    try {
      receipt = window.LeadFunnel?.receipt?.() || JSON.parse(sessionStorage.getItem('funnel_v2_receipt') || 'null');
    } catch { receipt = null; }
    const age = Date.now() - receipt?.created_at;
    const confirmed = typeof receipt?.receipt_id === 'string' && receipt.receipt_id.length > 0 &&
      receipt.receipt_id.length <= 128 && Number.isFinite(age) && age >= 0 && age < 60 * 60 * 1000;
    document.querySelectorAll('[data-confirmed-only]').forEach(node => { node.hidden = !confirmed; });
    document.querySelectorAll('[data-unconfirmed-only]').forEach(node => { node.hidden = confirmed; });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();
  window.addEventListener('pageshow', apply);
  // Never POST, call LeadFunnel.accepted, or expose receipt/customer data in a URL.
})();
