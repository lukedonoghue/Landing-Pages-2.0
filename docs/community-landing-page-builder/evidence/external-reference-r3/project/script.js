(() => {
  const form = document.getElementById('enquiry-form');
  const fields = ['name', 'email', 'phone', 'message'];
  const summary = document.getElementById('validation-summary');
  const status = document.getElementById('form-status');
  const submitButton = document.getElementById('submit-button');
  const formFields = document.getElementById('form-fields');
  const success = document.getElementById('form-success');
  const newEnquiry = document.getElementById('new-enquiry');
  const errors = new Map();
  let inFlight = false;
  let confirmed = false;
  let requestId = null;

  function value(id) {
    return document.getElementById(id).value.trim();
  }

  function errorFor(id) {
    const text = value(id);
    if (id === 'name' && !text) return 'Enter your name.';
    if (id === 'email') {
      if (!text) return 'Enter your email address.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return 'Enter a valid email address.';
    }
    if (id === 'phone' && text) {
      const validCharacters = /^\+?[0-9().\s-]+(?:\s*(?:ext\.?|x)\s*\d{1,6})?$/i.test(text);
      const digits = (text.match(/\d/g) || []).length;
      if (!validCharacters || digits < 7 || digits > 20) return 'Enter a usable phone number or leave it blank.';
    }
    if (id === 'message' && !text) return 'Tell us a little about the room you have in mind.';
    return '';
  }

  function renderErrors() {
    fields.forEach(id => {
      const input = document.getElementById(id);
      document.getElementById(`${id}-error`).textContent = errors.get(id) || '';
      input.setAttribute('aria-invalid', errors.has(id) ? 'true' : 'false');
    });
    if (!errors.size) {
      summary.hidden = true;
      summary.replaceChildren();
      return;
    }
    const title = document.createElement('strong');
    title.textContent = 'Please check these fields:';
    const list = document.createElement('ul');
    errors.forEach((message, id) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${id}`;
      link.textContent = message;
      link.addEventListener('click', event => {
        event.preventDefault();
        const input = document.getElementById(id);
        input.focus({ preventScroll: true });
        input.closest('.field').scrollIntoView({ block: 'center', behavior: 'instant' });
      });
      item.append(link);
      list.append(item);
    });
    summary.replaceChildren(title, list);
    summary.hidden = false;
  }

  fields.forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      if (inFlight || confirmed || !errors.has(id)) return;
      const next = errorFor(id);
      if (next) errors.set(id, next);
      else errors.delete(id);
      renderErrors();
    });
  });

  form.addEventListener('focusin', event => {
    const group = event.target.closest('.field, .form-action-row');
    if (!group) return;
    requestAnimationFrame(() => {
      const box = group.getBoundingClientRect();
      if (box.top < 16 || box.bottom > innerHeight - 16) {
        group.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
    });
  });

  function showStatus(message) {
    status.textContent = message;
    status.hidden = false;
    requestAnimationFrame(() => {
      status.focus({ preventScroll: true });
      status.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (inFlight || confirmed) return;
    errors.clear();
    fields.forEach(id => {
      const message = errorFor(id);
      if (message) errors.set(id, message);
    });
    renderErrors();
    status.hidden = true;
    if (errors.size) {
      requestAnimationFrame(() => {
        summary.focus({ preventScroll: true });
        summary.scrollIntoView({ block: 'start', behavior: 'instant' });
      });
      return;
    }

    const snapshot = {
      name: value('name'),
      email: value('email'),
      phone: value('phone'),
      message: value('message'),
      marketing: document.getElementById('marketing').checked
    };
    requestId = crypto.randomUUID();
    const thisRequest = requestId;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    inFlight = true;
    formFields.disabled = true;
    submitButton.disabled = true;
    submitButton.textContent = 'Checking preview...';

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...snapshot, requestId: thisRequest }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error('receiver-failed');
      const result = await response.json();
      if (result.status !== 'preview-confirmed' || result.requestId !== thisRequest || requestId !== thisRequest) throw new Error('receiver-unconfirmed');
      confirmed = true;
      form.hidden = true;
      success.hidden = false;
      requestAnimationFrame(() => {
        success.focus({ preventScroll: true });
        success.scrollIntoView({ block: 'center', behavior: 'instant' });
      });
    } catch (error) {
      showStatus(error.name === 'AbortError'
        ? 'The preview could not confirm what happened. Your details are still here. Please check before trying again.'
        : 'The preview could not confirm your enquiry. Your details are still here. Please try again.');
    } finally {
      clearTimeout(timer);
      inFlight = false;
      formFields.disabled = false;
      submitButton.disabled = false;
      submitButton.textContent = 'Enquire online';
    }
  });

  newEnquiry.addEventListener('click', () => {
    if (inFlight) return;
    form.reset();
    errors.clear();
    renderErrors();
    status.hidden = true;
    confirmed = false;
    requestId = null;
    success.hidden = true;
    form.hidden = false;
    document.getElementById('name').focus();
  });
})();
