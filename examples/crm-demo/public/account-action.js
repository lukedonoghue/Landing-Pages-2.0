const params = new URLSearchParams(window.location.hash.slice(1));
const token = params.get('token') || '';
const requestedPurpose = params.get('purpose') || '';
history.replaceState(null, '', `${location.pathname}${location.search}`);

const form = document.querySelector('#action-form');
const fields = document.querySelector('#password-fields');
const password = document.querySelector('#action-password');
const confirmation = document.querySelector('#action-confirm');
const error = document.querySelector('#action-error');
const status = document.querySelector('#action-status');
const submit = document.querySelector('#action-submit');
const submitLabel = submit.querySelector('span');
const title = document.querySelector('#action-title');
const description = document.querySelector('#action-description');
const needsPassword = requestedPurpose === 'invite' || requestedPurpose === 'reset';

if (!token) {
  title.textContent = 'This link is incomplete.';
  description.textContent = 'Open the full one-use link supplied by your workspace administrator.';
} else {
  title.textContent = needsPassword ? (requestedPurpose === 'invite' ? 'Create your password.' : 'Choose a new password.') : 'Confirm your email.';
  description.textContent = needsPassword ? 'Use at least 16 characters. Completing this action signs out any earlier sessions.' : 'Confirm this email address for your workspace account.';
  fields.hidden = !needsPassword;
  password.required = needsPassword; confirmation.required = needsPassword;
  submitLabel.textContent = needsPassword ? 'Save and continue' : 'Confirm email';
  form.hidden = false;
}

form.addEventListener('submit', async event => {
  event.preventDefault(); error.textContent = ''; status.textContent = '';
  if (needsPassword && password.value !== confirmation.value) { error.textContent = 'The passwords do not match.'; confirmation.focus(); return; }
  if (needsPassword && password.value.length < 16) { error.textContent = 'Use at least 16 characters for the new password.'; password.focus(); return; }
  submit.disabled = true; submitLabel.textContent = 'Completing…';
  try {
    const body = { token }; if (needsPassword) body.password = password.value;
    const response = await fetch('/api/auth/complete', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let data = {}; try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || 'This link could not be completed. It may be invalid or expired.');
    form.reset(); form.hidden = true; title.textContent = 'Account action complete.';
    description.textContent = 'You can now return to sign in.'; status.textContent = 'The secure link has been used.';
  } catch (failure) {
    error.textContent = failure instanceof TypeError ? 'Unable to connect. Check your connection and try again.' : failure.message || 'Unable to complete this action.';
  } finally { submit.disabled = false; submitLabel.textContent = needsPassword ? 'Save and continue' : 'Confirm email'; }
});
