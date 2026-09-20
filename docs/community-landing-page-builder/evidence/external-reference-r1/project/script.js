(() => {
  const form = document.querySelector('#lead-form');
  const fields = form.querySelector('#lead-fields');
  const summary = form.querySelector('#error-summary');
  const status = form.querySelector('#submit-status');
  const submit = form.querySelector('#submit-button');
  const result = document.querySelector('#result-panel');
  const newEnquiry = document.querySelector('#new-enquiry');
  const errors = new Map();
  const initialSubmit = submit.innerHTML;
  let inFlight = false;

  const labels = { name: 'Name', email: 'Email', phone: 'Phone' };
  const input = id => form.querySelector(`#${id}`);

  function validate(id) {
    const value = input(id).value.trim();
    if (id === 'name' && !value) return 'Enter your name.';
    if (id === 'email') {
      if (!value) return 'Enter your email address.';
      input(id).value = value;
      if (input(id).validity.typeMismatch) return 'Enter a valid email address.';
    }
    if (id === 'phone' && value) {
      const digits = (value.match(/\d/g) || []).length;
      if (!/^\+?[\d ()-]+(?:\s*(?:ext\.?|x)\s*\d+)?$/i.test(value) || digits < 7 || digits > 18) {
        return 'Enter a usable phone number, or leave this blank.';
      }
    }
    return '';
  }

  function showFieldError(id, message) {
    const control = input(id);
    form.querySelector(`#${id}-error`).textContent = message;
    if (message) {
      control.setAttribute('aria-invalid', 'true');
      errors.set(id, message);
    } else {
      control.removeAttribute('aria-invalid');
      errors.delete(id);
    }
  }

  function renderSummary() {
    summary.replaceChildren();
    summary.hidden = errors.size === 0;
    if (!errors.size) return;
    const intro = document.createElement('p');
    intro.textContent = 'Please check these fields:';
    const list = document.createElement('ul');
    for (const [id, message] of errors) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${id}`;
      link.textContent = `${labels[id]}: ${message}`;
      link.addEventListener('click', event => {
        event.preventDefault();
        input(id).focus();
      });
      item.append(link);
      list.append(item);
    }
    summary.append(intro, list);
  }

  for (const id of Object.keys(labels)) {
    input(id).addEventListener('input', () => {
      if (!errors.has(id)) return;
      showFieldError(id, validate(id));
      renderSummary();
    });
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (inFlight) return;
    status.hidden = true;
    for (const id of Object.keys(labels)) showFieldError(id, validate(id));
    renderSummary();
    if (errors.size) {
      summary.focus();
      summary.scrollIntoView({ block: 'center', behavior: 'instant' });
      return;
    }

    const snapshot = {
      name: input('name').value.trim(),
      email: input('email').value.trim(),
      phone: input('phone').value.trim(),
      postcode: input('postcode').value.trim(),
      use: input('use').value,
      message: input('message').value.trim(),
      marketing: input('marketing').checked
    };
    inFlight = true;
    fields.disabled = true;
    submit.disabled = true;
    submit.textContent = 'Sending...';
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
        signal: controller.signal
      });
      const receipt = await response.json();
      if (!response.ok || receipt.accepted !== true || typeof receipt.receipt !== 'string' || !receipt.receipt) {
        throw new Error('Unconfirmed response');
      }
      document.querySelector('#result-title').textContent = receipt.preview ? 'Preview complete.' : 'Thank you for your enquiry.';
      document.querySelector('#result-copy').textContent = receipt.preview ? 'Nothing was sent to The Garden Room Co.' : 'Your enquiry has been received. The team will be in touch.';
      form.hidden = true;
      result.hidden = false;
      result.focus();
      result.scrollIntoView({ block: 'center', behavior: 'instant' });
    } catch {
      status.textContent = 'We could not confirm this enquiry. Your entries are still here. Please try again later or call the team.';
      status.hidden = false;
      status.focus();
      status.scrollIntoView({ block: 'center', behavior: 'instant' });
    } finally {
      clearTimeout(deadline);
      fields.disabled = false;
      submit.disabled = false;
      submit.innerHTML = initialSubmit;
      inFlight = false;
    }
  });

  newEnquiry.addEventListener('click', () => {
    form.reset();
    for (const id of Object.keys(labels)) showFieldError(id, '');
    renderSummary();
    status.hidden = true;
    result.hidden = true;
    form.hidden = false;
    input('name').focus();
  });
})();
