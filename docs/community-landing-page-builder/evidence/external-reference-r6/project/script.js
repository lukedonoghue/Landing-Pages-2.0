const dialog = document.getElementById('enquiry-dialog');
const form = document.getElementById('enquiry-form');
const closeButton = document.getElementById('dialog-close');
const confirmedView = document.getElementById('confirmed-view');
const newEnquiryButton = document.getElementById('new-enquiry');
const errorSummary = document.getElementById('error-summary');
const errorList = document.getElementById('error-list');
const feedback = document.getElementById('form-feedback');
const submitStatus = document.getElementById('submit-status');
const submitButton = document.getElementById('submit-enquiry');
const formActions = document.getElementById('form-actions');
const fieldIds = ['name', 'email', 'phone', 'postcode', 'message'];
const fields = Object.fromEntries(fieldIds.map(id => [id, document.getElementById(id)]));
const errors = new Map();
let lastOpener = null;
let openingScrollY = 0;
let state = 'editing';
let inFlight = false;
let activeRequest = 0;

function openEnquiry(event) {
  lastOpener = event.currentTarget;
  openingScrollY = window.scrollY;
  dialog.showModal();
  document.body.classList.add('dialog-open');
  if (state === 'editing' || state === 'failed') fields.name.focus({ preventScroll: true });
  else closeButton.focus({ preventScroll: true });
}

document.querySelectorAll('[data-open-modal]').forEach(button => {
  button.addEventListener('click', openEnquiry);
});

closeButton.addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  document.body.classList.remove('dialog-open');
  window.scrollTo({ top: openingScrollY, behavior: 'instant' });
  lastOpener?.focus({ preventScroll: true });
});
dialog.addEventListener('focusin', event => {
  if (!event.target.closest('.dialog-scroll')) return;
  const target = event.target.getBoundingClientRect();
  const top = document.querySelector('.dialog-header').getBoundingClientRect().bottom;
  const bottom = formActions.getBoundingClientRect().top;
  if (target.top < top + 8 || target.bottom > bottom - 8) {
    event.target.scrollIntoView({ block: 'center', behavior: 'auto' });
  }
});

const menuButton = document.getElementById('menu-toggle');
const nav = document.getElementById('main-nav');
function closeMenu() {
  nav.classList.remove('is-open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open menu');
}
menuButton.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') === 'true';
  nav.classList.toggle('is-open', !expanded);
  menuButton.setAttribute('aria-expanded', String(!expanded));
  menuButton.setAttribute('aria-label', expanded ? 'Open menu' : 'Close menu');
});
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && nav.classList.contains('is-open')) closeMenu();
});

function validateField(id) {
  const field = fields[id];
  const value = field.value.trim();
  let message = '';
  if (id === 'name' && !value) message = 'Enter your name.';
  if (id === 'email') {
    if (!value) message = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) message = 'Enter a usable email address.';
  }
  if (id === 'phone' && value) {
    const digits = value.replace(/(?:ext\.?|x)\s*\d+$/i, '').replace(/\D/g, '');
    if (!/^\+?[0-9][0-9 ()-]*(?:\s*(?:ext\.?|x)\s*\d+)?$/i.test(value) || digits.length < 7 || digits.length > 18) {
      message = 'Enter a usable phone number with digits and standard separators.';
    }
  }
  if (id === 'message' && !value) message = 'Tell us what you have in mind.';

  const inlineError = document.getElementById(`${id}-error`);
  if (message) {
    errors.set(id, message);
    field.setAttribute('aria-invalid', 'true');
    inlineError.textContent = message;
    inlineError.hidden = false;
  } else {
    errors.delete(id);
    field.removeAttribute('aria-invalid');
    inlineError.textContent = '';
    inlineError.hidden = true;
  }
  return !message;
}

function syncErrorSummary() {
  errorList.replaceChildren();
  fieldIds.filter(id => errors.has(id)).forEach(id => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${id}`;
    link.dataset.fieldTarget = id;
    link.textContent = errors.get(id);
    item.append(link);
    errorList.append(item);
  });
  errorSummary.hidden = errors.size === 0;
}

form.addEventListener('input', event => {
  const id = event.target.id;
  if (errors.has(id)) {
    validateField(id);
    syncErrorSummary();
  }
  if (state === 'failed') {
    feedback.hidden = true;
    feedback.textContent = '';
    state = 'editing';
  }
});

errorList.addEventListener('click', event => {
  const link = event.target.closest('a[data-field-target]');
  if (!link) return;
  event.preventDefault();
  const field = fields[link.dataset.fieldTarget];
  field.focus({ preventScroll: true });
  field.scrollIntoView({ block: 'center', behavior: 'auto' });
});

function snapshot() {
  return {
    name: fields.name.value.trim(),
    email: fields.email.value.trim(),
    phone: fields.phone.value.trim(),
    postcode: fields.postcode.value.trim(),
    message: fields.message.value.trim(),
    marketing: document.getElementById('marketing').checked
  };
}

function setPending(pending) {
  form.querySelectorAll('input, textarea').forEach(control => { control.disabled = pending; });
  submitButton.disabled = pending;
  submitStatus.textContent = pending ? 'Checking the local preview receiver...' : '';
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (inFlight || state === 'confirmed') return;
  fieldIds.forEach(validateField);
  syncErrorSummary();
  if (errors.size) {
    errorSummary.focus({ preventScroll: true });
    errorSummary.scrollIntoView({ block: 'start', behavior: 'auto' });
    return;
  }

  const submitted = snapshot();
  const requestId = ++activeRequest;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  inFlight = true;
  state = 'pending';
  feedback.hidden = true;
  feedback.textContent = '';
  setPending(true);

  try {
    const response = await fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submitted),
      signal: controller.signal
    });
    const result = await response.json();
    if (!response.ok || result?.localPreview !== true || !result.receipt) throw new Error('No confirmed local receipt');
    if (requestId !== activeRequest) return;
    state = 'confirmed';
    form.hidden = true;
    confirmedView.hidden = false;
    formActions.hidden = true;
    if (dialog.open) {
      confirmedView.querySelector('h3').setAttribute('tabindex', '-1');
      confirmedView.querySelector('h3').focus();
    }
  } catch (error) {
    if (requestId !== activeRequest) return;
    state = 'failed';
    feedback.textContent = error.name === 'AbortError'
      ? 'We could not confirm whether the local preview receiver accepted this request. Your details are still here; please retry or call the team.'
      : 'We could not confirm this preview request. Your details are still here; please retry or call the team.';
    feedback.hidden = false;
    if (dialog.open) {
      feedback.focus({ preventScroll: true });
      feedback.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
  } finally {
    window.clearTimeout(timeout);
    inFlight = false;
    setPending(false);
  }
});

newEnquiryButton.addEventListener('click', () => {
  if (inFlight) return;
  ++activeRequest;
  state = 'editing';
  form.reset();
  errors.clear();
  fieldIds.forEach(id => {
    fields[id].removeAttribute('aria-invalid');
    const inlineError = document.getElementById(`${id}-error`);
    inlineError.textContent = '';
    inlineError.hidden = true;
  });
  syncErrorSummary();
  feedback.textContent = '';
  feedback.hidden = true;
  confirmedView.hidden = true;
  form.hidden = false;
  formActions.hidden = false;
  fields.name.focus();
});
