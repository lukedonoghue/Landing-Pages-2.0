const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('#main-nav');

menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('open', open);
});
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  menuButton.setAttribute('aria-expanded', 'false');
  nav.classList.remove('open');
}));

const form = document.querySelector('#enquiry-form');
const summary = document.querySelector('#error-summary');
const result = document.querySelector('#form-result');
const submitButton = form.querySelector('[type="submit"]');
const successPanel = document.querySelector('#success-panel');
const newEnquiry = document.querySelector('#new-enquiry');
const fieldIds = ['name', 'email', 'phone', 'message'];
let attempted = false;
let inFlight = false;
let requestId = 0;

function messageFor(input) {
  const value = input.value.trim();
  if (input.required && !value) return `Enter your ${input.id === 'message' ? 'project details' : input.id}.`;
  if (input.id === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.';
  if (input.id === 'phone' && value) {
    const validFormat = /^\+?[0-9()\s.\-]{7,25}(?:\s*(?:x|ext\.?)\s*\d{1,6})?$/i.test(value);
    const digitCount = (value.match(/\d/g) || []).length;
    if (!validFormat || digitCount < 7 || digitCount > 21) return 'Enter a usable phone number or leave this blank.';
  }
  return '';
}

function setFieldError(input, message) {
  document.querySelector(`#${input.id}-error`).textContent = message;
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function updateSummary() {
  const errors = fieldIds.map(id => ({ input: document.getElementById(id), message: messageFor(document.getElementById(id)) })).filter(item => item.message);
  if (!errors.length) {
    summary.hidden = true;
    summary.replaceChildren();
    return errors;
  }
  const heading = document.createElement('p');
  heading.textContent = 'Please check these fields:';
  const list = document.createElement('ul');
  for (const { input, message } of errors) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${input.id}`;
    link.textContent = message;
    link.addEventListener('click', event => { event.preventDefault(); input.focus(); });
    item.append(link);
    list.append(item);
  }
  summary.replaceChildren(heading, list);
  summary.hidden = false;
  return errors;
}

for (const id of fieldIds) {
  const input = document.getElementById(id);
  input.addEventListener('input', () => {
    if (!attempted) return;
    setFieldError(input, messageFor(input));
    updateSummary();
  });
}

function showResult(message, pending = false) {
  result.textContent = message;
  result.classList.toggle('pending', pending);
  result.hidden = false;
  if (!pending) result.focus();
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (inFlight) return;
  attempted = true;
  result.hidden = true;
  for (const id of fieldIds) {
    const input = document.getElementById(id);
    setFieldError(input, messageFor(input));
  }
  const errors = updateSummary();
  if (errors.length) {
    errors[0].input.focus();
    return;
  }

  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const preview = form.dataset.formMode !== 'live';
  if (preview && !local) {
    showResult('This preview does not send details. Your entries are still here.');
    return;
  }

  const submitted = Object.fromEntries(fieldIds.map(id => [id, document.getElementById(id).value.trim()]));
  submitted.marketing = document.getElementById('marketing').checked;
  const currentRequest = ++requestId;
  inFlight = true;
  form.querySelectorAll('input, textarea').forEach(input => { input.disabled = true; });
  submitButton.disabled = true;
  showResult('Checking your preview enquiry...', true);
  const controller = new AbortController();
  const previewMode = preview ? new URLSearchParams(location.search).get('preview') || '' : '';
  const deadline = setTimeout(() => controller.abort(), previewMode === 'delay' ? 800 : 8000);

  try {
    const response = await fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(preview ? { 'X-Preview-Mode': previewMode } : {}) },
      body: JSON.stringify(submitted),
      signal: controller.signal
    });
    const receipt = await response.json();
    if (!response.ok || receipt.ok !== true || !receipt.receipt) throw new Error('No confirmation receipt');
    if (currentRequest !== requestId) return;
    if (!preview) {
      document.getElementById('success-title').textContent = 'Thank you for your enquiry.';
      document.getElementById('success-copy').textContent = 'The team has received your details and will be in touch.';
    }
    form.hidden = true;
    successPanel.hidden = false;
    successPanel.focus();
  } catch {
    if (currentRequest === requestId) showResult('We could not confirm this enquiry. Your entries are still here. Please try again.');
  } finally {
    clearTimeout(deadline);
    inFlight = false;
    form.querySelectorAll('input, textarea').forEach(input => { input.disabled = false; });
    submitButton.disabled = false;
  }
});

newEnquiry.addEventListener('click', () => {
  requestId++;
  form.reset();
  attempted = false;
  for (const id of fieldIds) setFieldError(document.getElementById(id), '');
  summary.hidden = true;
  summary.replaceChildren();
  result.hidden = true;
  successPanel.hidden = true;
  form.hidden = false;
  document.getElementById('name').focus();
});
