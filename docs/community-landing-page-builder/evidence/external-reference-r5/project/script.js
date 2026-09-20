const dialog = document.querySelector('#enquiry-dialog');
const form = document.querySelector('#enquiry-form');
const content = document.querySelector('#enquiry-content');
const success = document.querySelector('#enquiry-success');
const summary = document.querySelector('#error-summary');
const result = document.querySelector('#form-result');
const submitButton = document.querySelector('#submit-enquiry');
const fieldNames = ['name', 'email', 'phone', 'location', 'message'];
const labels = {
  name: 'Your name',
  email: 'Email address',
  phone: 'Phone number',
  location: 'Town or postcode',
  message: 'What would you like to create?'
};

let lastOpener = null;
let previousOverflow = '';
let pending = false;
let confirmed = false;
const currentErrors = new Map();

function openDialog(opener) {
  lastOpener = opener;
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  dialog.showModal();
  if (confirmed) success.focus();
  else document.querySelector('#name').focus();
}

document.querySelectorAll('[data-open-modal]').forEach(button => {
  button.addEventListener('click', () => openDialog(button));
});
document.querySelector('[data-close-modal]').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  document.body.style.overflow = previousOverflow;
  lastOpener?.focus();
});
dialog.addEventListener('click', event => {
  if (event.target === dialog) dialog.close();
});
dialog.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const focusable = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]')]
    .filter(element => element.getClientRects().length && !element.closest('[hidden]'));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || document.activeElement === success)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
document.addEventListener('focusin', event => {
  if (dialog.open && !dialog.contains(event.target)) dialog.querySelector('[data-close-modal]').focus();
});
document.querySelectorAll('.mobile-menu nav a').forEach(link => {
  link.addEventListener('click', () => link.closest('details').removeAttribute('open'));
});

const fieldArea = document.querySelector('.form-fields');
form.addEventListener('focusin', event => {
  if (!fieldArea.contains(event.target)) return;
  requestAnimationFrame(() => {
    const field = event.target.closest('.field');
    if (!field) return;
    const areaBox = fieldArea.getBoundingClientRect();
    const fieldBox = field.getBoundingClientRect();
    if (fieldBox.bottom > areaBox.bottom - 10) {
      fieldArea.scrollTop += fieldBox.bottom - areaBox.bottom + 10;
    } else if (fieldBox.top < areaBox.top + 10) {
      fieldArea.scrollTop += fieldBox.top - areaBox.top - 10;
    }
  });
});

function snapshot() {
  return {
    name: form.elements.name.value.trim(),
    email: form.elements.email.value.trim(),
    phone: form.elements.phone.value.trim(),
    location: form.elements.location.value.trim(),
    message: form.elements.message.value.trim(),
    marketing: form.elements.marketing.checked
  };
}

function errorFor(name, values) {
  if (name === 'name' && !values.name) return 'Enter your name.';
  if (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return 'Enter a valid email address.';
  if (name === 'phone' && values.phone) {
    const syntax = /^\+?[0-9().\s-]+(?:\s*(?:ext\.?|x)\s*\d{1,6})?$/i;
    const digits = (values.phone.match(/\d/g) || []).length;
    if (!syntax.test(values.phone) || digits < 7 || digits > 22) return 'Enter a usable phone number or leave this blank.';
  }
  if (name === 'message' && !values.message) return 'Tell us a little about the room you have in mind.';
  return '';
}

function setFieldError(name, error) {
  const control = form.elements[name];
  const message = document.querySelector(`#${name}-error`);
  message.textContent = error;
  if (error) {
    control.setAttribute('aria-invalid', 'true');
    currentErrors.set(name, error);
  } else {
    control.removeAttribute('aria-invalid');
    currentErrors.delete(name);
  }
}

function updateSummary() {
  summary.replaceChildren();
  if (!currentErrors.size) {
    summary.hidden = true;
    return;
  }
  const intro = document.createElement('strong');
  intro.textContent = 'Please check the following:';
  const list = document.createElement('ul');
  for (const [name] of currentErrors) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${name}`;
    link.textContent = labels[name];
    link.addEventListener('click', event => {
      event.preventDefault();
      const control = form.elements[name];
      const area = document.querySelector('.form-fields');
      const field = control.closest('.field');
      area.scrollTop += field.getBoundingClientRect().top - area.getBoundingClientRect().top - 12;
      control.focus({ preventScroll: true });
    });
    item.append(link);
    list.append(item);
  }
  summary.append(intro, list);
  summary.hidden = false;
}

for (const name of fieldNames) {
  form.elements[name].addEventListener('input', () => {
    if (!currentErrors.has(name)) return;
    setFieldError(name, errorFor(name, snapshot()));
    updateSummary();
  });
}

function setPending(value) {
  pending = value;
  submitButton.disabled = value;
  for (const name of fieldNames) form.elements[name].disabled = value;
  form.elements.marketing.disabled = value;
  submitButton.textContent = value ? 'Checking preview...' : 'Preview enquiry';
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (pending || confirmed) return;
  result.hidden = true;
  const values = snapshot();
  for (const name of fieldNames) setFieldError(name, errorFor(name, values));
  updateSummary();
  if (currentErrors.size) {
    document.querySelector('.form-fields').scrollTop = 0;
    summary.focus({ preventScroll: true });
    return;
  }

  setPending(true);
  const requestId = crypto.randomUUID();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  result.textContent = 'Checking this preview...';
  result.hidden = false;
  try {
    const response = await fetch('/__preview/enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, requestId }),
      signal: controller.signal
    });
    const receipt = await response.json();
    if (!response.ok || receipt.confirmed !== true || receipt.preview !== true || receipt.requestId !== requestId) {
      throw new Error('Unconfirmed preview response');
    }
    confirmed = true;
    content.hidden = true;
    success.hidden = false;
    dialog.setAttribute('aria-labelledby', 'success-title');
    dialog.scrollTop = 0;
    success.focus({ preventScroll: true });
  } catch {
    result.textContent = 'This preview could not be confirmed. Your entries are still here. Please try again.';
    result.hidden = false;
    result.focus({ preventScroll: true });
  } finally {
    window.clearTimeout(timeout);
    setPending(false);
  }
});

document.querySelector('#new-enquiry').addEventListener('click', () => {
  confirmed = false;
  form.reset();
  currentErrors.clear();
  for (const name of fieldNames) setFieldError(name, '');
  updateSummary();
  result.hidden = true;
  success.hidden = true;
  content.hidden = false;
  dialog.setAttribute('aria-labelledby', 'dialog-title');
  document.querySelector('#name').focus();
});
