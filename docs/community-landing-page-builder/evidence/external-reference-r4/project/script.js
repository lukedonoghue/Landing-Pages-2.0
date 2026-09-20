(() => {
  const dialog = document.querySelector('#enquiry-dialog');
  const form = document.querySelector('#enquiry-form');
  const title = document.querySelector('#dialog-title');
  const intro = document.querySelector('#dialog-intro');
  const fields = document.querySelector('#form-fields');
  const summary = document.querySelector('#error-summary');
  const status = document.querySelector('#form-status');
  const submit = document.querySelector('#submit-enquiry');
  const result = document.querySelector('#result-panel');
  const controls = {
    name: document.querySelector('#enquiry-name'),
    email: document.querySelector('#enquiry-email'),
    phone: document.querySelector('#enquiry-phone'),
    message: document.querySelector('#enquiry-message')
  };
  const labels = { name: 'Your name', email: 'Email address', phone: 'Phone number', message: 'What do you have in mind?' };
  const errors = new Map();
  let opener = null;
  let inFlight = false;
  let requestId = 0;
  let confirmed = false;

  function snapshot() {
    return JSON.stringify({
      name: controls.name.value.trim(),
      email: controls.email.value.trim(),
      phone: controls.phone.value.trim(),
      message: controls.message.value.trim(),
      marketing: document.querySelector('#enquiry-marketing').checked
    });
  }

  function validate(key) {
    const value = controls[key].value.trim();
    if (key === 'name' && !value) return 'Enter your name.';
    if (key === 'email') {
      if (!value) return 'Enter your email address.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.';
    }
    if (key === 'phone' && value) {
      const normalPhone = /^\+?[0-9 ()\-.]+(?:\s*(?:ext\.?|x)\s*\d+)?$/i.test(value);
      if (!normalPhone || (value.match(/\d/g) || []).length < 7) return 'Enter a usable phone number or leave this blank.';
    }
    if (key === 'message' && !value) return 'Tell us a little about your plans.';
    return '';
  }

  function renderErrors() {
    for (const [key, control] of Object.entries(controls)) {
      const message = errors.get(key) || '';
      document.querySelector(`#${key}-error`).textContent = message;
      control.setAttribute('aria-invalid', message ? 'true' : 'false');
    }
    const list = summary.querySelector('ul');
    list.replaceChildren();
    for (const [key] of errors) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${controls[key].id}`;
      link.textContent = labels[key];
      link.addEventListener('click', event => {
        event.preventDefault();
        revealField(key);
      });
      item.append(link);
      list.append(item);
    }
    summary.hidden = errors.size === 0;
  }

  function revealField(key) {
    const control = controls[key];
    control.focus({ preventScroll: true });
    control.closest('.field').scrollIntoView({ block: 'center', behavior: 'instant' });
  }

  function showStatus(message, kind) {
    status.textContent = message;
    status.dataset.kind = kind;
    status.hidden = false;
    status.focus({ preventScroll: true });
    status.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }

  for (const [key, control] of Object.entries(controls)) {
    control.addEventListener('input', () => {
      if (!errors.has(key)) return;
      const message = validate(key);
      if (message) errors.set(key, message);
      else errors.delete(key);
      renderErrors();
    });
  }

  document.querySelectorAll('[data-open-modal]').forEach(button => {
    button.addEventListener('click', () => {
      opener = button;
      dialog.showModal();
      if (confirmed) document.querySelector('#new-enquiry').focus();
      else if (inFlight) document.querySelector('#close-dialog').focus();
      else controls.name.focus();
    });
  });
  document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });
  document.querySelectorAll('.mobile-menu nav a').forEach(link => {
    link.addEventListener('click', () => { link.closest('details').open = false; });
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (inFlight || confirmed) return;
    status.hidden = true;
    errors.clear();
    for (const key of Object.keys(controls)) {
      const message = validate(key);
      if (message) errors.set(key, message);
    }
    renderErrors();
    if (errors.size) {
      revealField(errors.keys().next().value);
      return;
    }

    const submittedSnapshot = snapshot();
    const id = ++requestId;
    inFlight = true;
    fields.disabled = true;
    submit.disabled = true;
    submit.textContent = 'Checking...';
    const adapter = window.GRC_LEAD_ADAPTER || (async () => ({ status: 'preview-disabled' }));
    const timeoutMs = Number(window.GRC_PREVIEW_TIMEOUT_MS) || 8000;
    let timer;
    try {
      const outcome = await Promise.race([
        Promise.resolve().then(() => adapter(JSON.parse(submittedSnapshot))),
        new Promise(resolve => { timer = setTimeout(() => resolve({ status: 'uncertain' }), timeoutMs); })
      ]);
      if (id !== requestId) return;
      if (snapshot() !== submittedSnapshot) {
        showStatus("We couldn't confirm this preview. Your entries are still here.", 'uncertain');
      } else if (outcome?.ok === true) {
        confirmed = true;
        title.textContent = 'Preview complete';
        intro.hidden = true;
        form.hidden = true;
        result.hidden = false;
        document.querySelector('#new-enquiry').focus();
      } else if (outcome?.status === 'preview-disabled') {
        showStatus('This preview does not send details. Your entries are still here.', 'preview');
      } else if (outcome?.status === 'uncertain') {
        showStatus("We couldn't confirm this preview. Your entries are still here.", 'uncertain');
      } else {
        showStatus("We couldn't complete this preview. Your entries are still here.", 'error');
      }
    } catch {
      if (id === requestId) showStatus("We couldn't complete this preview. Your entries are still here.", 'error');
    } finally {
      clearTimeout(timer);
      if (id === requestId) {
        inFlight = false;
        fields.disabled = false;
        submit.disabled = false;
        submit.textContent = 'Send enquiry';
      }
    }
  });

  document.querySelector('#new-enquiry').addEventListener('click', () => {
    requestId++;
    confirmed = false;
    form.reset();
    errors.clear();
    renderErrors();
    status.hidden = true;
    result.hidden = true;
    form.hidden = false;
    intro.hidden = false;
    title.textContent = 'Tell us about your garden room';
    controls.name.focus();
  });
})();
