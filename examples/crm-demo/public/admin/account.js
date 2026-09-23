import { secureFetch } from './secure-fetch.js';
const node = (tag, text, cls) => { const el = document.createElement(tag); if (text) el.textContent = text; if (cls) el.className = cls; return el; };
export function initAccountPanel(host, { onSessionEnded = () => window.location.assign('/login.html'), onNotifications = () => {}, currentUser = null, permissions = {} } = {}) {
  let disposed = false; let marker = 0; let pending = false; let exportParams = new URLSearchParams();
  const canAcknowledge = permissions.edit_leads === true;
  const canExport = permissions.export_leads === true;
  const section = node('section', '', 'account-panel'); section.setAttribute('aria-label', 'Account and lead alerts');
  const notice = node('div', '', 'account-notice');
  const count = node('span', 'Checking new enquiries…'); count.setAttribute('role', 'status');
  const mark = node('button', 'Mark as seen', 'button secondary'); mark.type = 'button'; mark.disabled = true;
  notice.append(count); if (canAcknowledge) notice.append(mark);
  const exportButton = node('button', 'Export contacts CSV', 'button secondary'); exportButton.type = 'button';
  const details = node('details', '', 'account-details'); const summary = node('summary', 'Account & security');
  const user = node('p', 'Loading account…', 'account-username');
  const form = node('form', '', 'account-form');
  const currentLabel = node('label', 'Current password'); const current = node('input');
  current.type = 'password'; current.autocomplete = 'current-password'; current.required = true; current.maxLength = 1024; currentLabel.append(current);
  const nextLabel = node('label', 'New password (at least 16 characters)'); const next = node('input');
  next.type = 'password'; next.autocomplete = 'new-password'; next.required = true; next.minLength = 16; next.maxLength = 1024; nextLabel.append(next);
  const confirmLabel = node('label', 'Confirm new password'); const confirmation = node('input');
  confirmation.type = 'password'; confirmation.autocomplete = 'new-password'; confirmation.required = true; confirmLabel.append(confirmation);
  const save = node('button', 'Change password & sign out', 'button primary'); save.type = 'submit';
  form.append(currentLabel, nextLabel, confirmLabel, save);
  const revoke = node('button', 'Sign out all devices', 'button secondary'); revoke.type = 'button';
  const description = node('p', 'Changing your password signs out every device. Forgot-password requests require another administrator’s approval before email delivery.', 'account-help');
  const status = node('p', '', 'account-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  details.append(summary, user, description, form, revoke); section.append(notice); if (canExport) section.append(exportButton); section.append(details, status); host.replaceChildren(section);
  async function request(url, options = {}) {
    const response = await secureFetch(url, { credentials: 'same-origin', cache: 'no-store', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to complete this action.');
    return data;
  }
  function report(error) { if (!disposed) status.textContent = error.message || 'Unable to connect. Please try again.'; }
  async function refreshNotifications() {
    if (disposed || pending || document.hidden) return;
    pending = true;
    try {
      const data = await request('/api/admin/notifications');
      if (disposed) return;
      marker = data.through; count.textContent = data.unread_count ? `${data.unread_count.toLocaleString()} new ${data.unread_count === 1 ? 'enquiry' : 'enquiries'}` : 'You’re up to date';
      if (canAcknowledge) mark.disabled = !data.unread_count; onNotifications(data); return data;
    } catch (error) { count.textContent = 'Lead alerts unavailable'; report(error); }
    finally { pending = false; }
  }
  if (canAcknowledge) mark.addEventListener('click', async () => {
    mark.disabled = true;
    try { await request('/api/admin/notifications/acknowledge', { method: 'POST', body: JSON.stringify({ through: marker }) }); await refreshNotifications(); }
    catch (error) { report(error); mark.disabled = false; }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); status.textContent = '';
    if (next.value !== confirmation.value) { status.textContent = 'The new passwords do not match.'; confirmation.focus(); return; }
    save.disabled = true;
    try {
      await request('/api/admin/account/password', { method: 'POST', body: JSON.stringify({ current_password: current.value, new_password: next.value }) });
      form.reset(); status.textContent = 'Password changed. Sign in with your new password.'; onSessionEnded();
    } catch (error) { report(error); } finally { save.disabled = false; }
  });
  revoke.addEventListener('click', async () => {
    revoke.disabled = true;
    try { await request('/api/admin/account/revoke-sessions', { method: 'POST', body: '{}' }); onSessionEnded(); }
    catch (error) { report(error); revoke.disabled = false; }
  });
  if (canExport) exportButton.addEventListener('click', async () => {
    exportButton.disabled = true; status.textContent = 'Preparing contacts…';
    try {
      const response = await secureFetch(`/api/admin/leads/export.csv?${exportParams}`, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Export failed.'); }
      const file = await response.blob(); const url = URL.createObjectURL(file); const anchor = node('a');
      anchor.href = url; anchor.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`; document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      status.textContent = response.headers.get('X-Export-Truncated') === 'true'
        ? `Downloaded the newest 10,000 of ${response.headers.get('X-Export-Total')} matching contacts. Narrow your filters to export the remaining records.`
        : `Downloaded ${response.headers.get('X-Export-Count')} contacts matching your contact-list filters.`;
    } catch (error) { report(error); } finally { exportButton.disabled = false; }
  });
  if (currentUser) {
    const identity = currentUser.username || currentUser.email || 'workspace user';
    const role = currentUser.role === 'viewer' ? 'View-only' : currentUser.role ? currentUser.role[0].toUpperCase() + currentUser.role.slice(1) : '';
    user.textContent = `Signed in as ${identity}${role ? ` · ${role}` : ''}`;
  } else request('/api/admin/account').then(data => { if (!disposed) user.textContent = `Signed in as ${data.username}`; }).catch(report);
  const visible = () => { if (!document.hidden) refreshNotifications(); };
  document.addEventListener('visibilitychange', visible); const timer = setInterval(refreshNotifications, 60000); refreshNotifications();
  return { refreshNotifications, setExportParams(params) {
    exportParams = new URLSearchParams();
    for (const key of ['q', 'status', 'source', 'traffic', 'device']) if (params.has(key)) exportParams.set(key, params.get(key));
  }, dispose() { disposed = true; clearInterval(timer); document.removeEventListener('visibilitychange', visible); } };
}
