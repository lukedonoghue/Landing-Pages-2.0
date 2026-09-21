(() => {
  const title = document.querySelector('[data-success-title]');
  const kicker = document.querySelector('[data-success-kicker]');
  const message = document.querySelector('[data-success-message]');
  const followUp = document.querySelector('[data-success-follow-up]');
  const receiptLine = document.querySelector('[data-receipt]');

  const render = () => {
    const receipt = window.LeadFunnel?.receipt?.();
    const valid = receipt && typeof receipt.receipt_id === 'string' && receipt.receipt_id.length > 0;
    if (valid) {
      kicker.textContent = 'Test enquiry stored';
      title.textContent = 'Your synthetic enquiry is in the demonstration CRM.';
      message.textContent = 'The CRM confirmed the record. Nothing was emailed or sent by webhook to Clarentis.';
      followUp.textContent = 'The demonstration stores a synthetic test enquiry in its isolated CRM. It sends no email or webhook to Clarentis.';
      followUp.hidden = false;
      receiptLine.textContent = `Receipt ${receipt.receipt_id.slice(0, 8)}...`;
      receiptLine.hidden = false;
    } else {
      kicker.textContent = 'No confirmed receipt';
      title.textContent = 'There is no confirmed test enquiry in this browser.';
      message.textContent = 'A direct visit or refresh does not create a lead or conversion. Return to the demonstration to submit a clearly labelled synthetic test enquiry.';
      followUp.hidden = true;
      receiptLine.hidden = true;
    }
  };

  if (window.LeadFunnel?.ready) window.LeadFunnel.ready.finally(render);
  else window.addEventListener('load', render, { once: true });
})();
