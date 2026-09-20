const dialog = document.querySelector('#quote-dialog');
const form = document.querySelector('#quote-form');
const handoff = document.querySelector('#handoff');
const draftLink = document.querySelector('#draft-link');
const errorSummary = document.querySelector('#error-summary');
const errorList = document.querySelector('#error-list');
const fieldIds = ['name', 'email', 'phone', 'business', 'support'];
const labels = {
  name: 'Your name',
  email: 'Email address',
  phone: 'Phone number',
  business: 'Business type',
  support: 'What support do you need?'
};
const errors = new Map();
let opener = null;
let originalScroll = 0;

function valueOf(id) {
  return document.getElementById(id).value.trim();
}

function validationMessage(id) {
  const value = valueOf(id);
  if (id === 'name' && !value) return 'Enter your name.';
  if (id === 'email') {
    if (!value) return 'Enter your email address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.';
  }
  if (id === 'phone' && value) {
    const plausiblePhone = /^\+?[\d\s().-]+(?:\s*(?:ext\.?|x)\s*\d+)?$/i.test(value);
    if (!plausiblePhone || (value.match(/\d/g) || []).length < 7) return 'Enter a usable phone number or leave this blank.';
  }
  if (id === 'business' && !value) return 'Choose your business type.';
  if (id === 'support' && !value) return 'Tell us what support you need.';
  return '';
}

function paintError(id, message) {
  const control = document.getElementById(id);
  document.getElementById(`${id}-error`).textContent = message;
  if (message) control.setAttribute('aria-invalid', 'true');
  else control.removeAttribute('aria-invalid');
}

function updateSummary() {
  errorList.replaceChildren();
  errorSummary.hidden = errors.size === 0;
  for (const [id, message] of errors) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${id}`;
    link.textContent = `${labels[id]}: ${message}`;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      focusField(id);
    });
    item.append(link);
    errorList.append(item);
  }
}

function focusField(id) {
  const group = document.getElementById(`field-${id}`);
  const control = document.getElementById(id);
  control.focus({ preventScroll: true });
  group.scrollIntoView({ block: 'center', behavior: 'auto' });
}

function checkField(id) {
  const message = validationMessage(id);
  if (message) errors.set(id, message);
  else errors.delete(id);
  paintError(id, message);
  updateSummary();
  return !message;
}

for (const id of fieldIds) {
  const control = document.getElementById(id);
  control.addEventListener(id === 'business' ? 'change' : 'input', () => {
    if (errors.has(id)) checkField(id);
  });
}

document.querySelectorAll('[data-open-modal]').forEach((button) => {
  button.addEventListener('click', () => {
    opener = button;
    originalScroll = window.scrollY;
    dialog.showModal();
    if (handoff.hidden) document.getElementById('name').focus({ preventScroll: true });
    else handoff.focus({ preventScroll: true });
  });
});

document.getElementById('dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;
  const focusable = [...dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')]
    .filter((element) => element.getClientRects().length > 0);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
document.addEventListener('focusin', (event) => {
  if (dialog.open && !dialog.contains(event.target)) document.getElementById('dialog-close').focus();
});
dialog.addEventListener('close', () => {
  if (opener && opener.isConnected) opener.focus({ preventScroll: true });
  if (window.scrollY !== originalScroll) window.scrollTo({ top: originalScroll, behavior: 'instant' });
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  errors.clear();
  for (const id of fieldIds) {
    const message = validationMessage(id);
    if (message) errors.set(id, message);
    paintError(id, message);
  }
  updateSummary();
  if (errors.size) {
    focusField(errors.keys().next().value);
    return;
  }

  const name = valueOf('name');
  const subject = `Fixed-fee quote enquiry from ${name}`;
  const body = [
    'Hello Clarentis,',
    '',
    'I would like to request a fixed-fee quote and free initial consultation.',
    '',
    `Name: ${name}`,
    `Email: ${valueOf('email')}`,
    `Phone: ${valueOf('phone') || 'Not provided'}`,
    `Business type: ${valueOf('business')}`,
    `Support needed: ${valueOf('support')}`,
    '',
    'Please let me know the next step.'
  ].join('\n');
  draftLink.href = `mailto:info@clarentis.co.uk?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  form.hidden = true;
  handoff.hidden = false;
  dialog.scrollTop = 0;
  handoff.focus({ preventScroll: true });
});

document.getElementById('edit-details').addEventListener('click', () => {
  handoff.hidden = true;
  form.hidden = false;
  document.getElementById('name').focus({ preventScroll: true });
});

document.querySelectorAll('.mobile-menu nav a').forEach((link) => {
  link.addEventListener('click', () => link.closest('details').removeAttribute('open'));
});
