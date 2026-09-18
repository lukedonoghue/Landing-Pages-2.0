// Calendar arithmetic uses date-only UTC values; the caller supplies the reporting-zone today.
const date = value => new Date(`${value}T12:00:00Z`);
const iso = value => value.toISOString().slice(0, 10);
export const shiftDays = (value, count) => { const next = date(value); next.setUTCDate(next.getUTCDate() + count); return iso(next); };
const monthStart = (value, offset = 0) => { const next = date(value); next.setUTCDate(1); next.setUTCMonth(next.getUTCMonth() + offset); return iso(next); };
export function datePresets(today, earliest = today) {
  const year = Number(today.slice(0, 4));
  return [
    { id: 'last30', label: 'Last 30 days', from: shiftDays(today, -29), to: today },
    { id: 'thisMonth', label: 'This month', from: monthStart(today), to: today },
    { id: 'lastMonth', label: 'Last month', from: monthStart(today, -1), to: shiftDays(monthStart(today), -1) },
    { id: 'last3', label: 'Last 3 months', from: monthStart(today, -3), to: shiftDays(monthStart(today), -1) },
    { id: 'last6', label: 'Last 6 months', from: monthStart(today, -6), to: shiftDays(monthStart(today), -1) },
    { id: 'thisYear', label: 'This year', from: `${year}-01-01`, to: today },
    { id: 'lastYear', label: 'Last year', from: `${year - 1}-01-01`, to: `${year - 1}-12-31` },
    { id: 'all', label: 'All time', from: earliest && earliest < today ? earliest : today, to: today }
  ];
}
export function calendarDays(month) {
  const first = monthStart(month);
  const start = shiftDays(first, -date(first).getUTCDay());
  return Array.from({ length: 42 }, (_, i) => shiftDays(start, i));
}
const format = (value, options) => new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(date(value));
export const rangeLabel = (from, to, full = false) => `${format(from, { month: 'short', day: 'numeric', ...(full ? { year: 'numeric' } : {}) })} - ${format(to, { month: 'short', day: 'numeric', ...(full ? { year: 'numeric' } : {}) })}`;

export function createDateRangePicker(root, { today, earliest, onChange }) {
  const trigger = root.querySelector('[data-range-trigger]');
  const popup = root.querySelector('[data-range-popover]');
  const presetsNode = root.querySelector('[data-range-presets]');
  const grid = root.querySelector('[data-range-grid]');
  const caption = root.querySelector('[data-range-caption]');
  let committed = datePresets(today(), earliest())[0];
  let month = monthStart(committed.from), anchor = null, hover = null, focusDay = committed.from;
  let open = false;
  function node(tag, cls, text) { const el = document.createElement(tag); if (cls) el.className = cls; if (text !== undefined) el.textContent = text; return el; }
  function commit(from, to, preset = 'custom') {
    committed = { from, to, id: preset }; anchor = null; hover = null;
    root.querySelector('#date-from').value = from; root.querySelector('#date-to').value = to;
    root.querySelector('[data-range-label]').textContent = rangeLabel(from, to, true);
    trigger.setAttribute('aria-label', `Date range: ${rangeLabel(from, to, true)}. Change date range`);
    close(true); onChange({ from, to, preset });
  }
  function paintSelection() {
    const from = anchor ? [anchor, hover || anchor].sort()[0] : committed.from;
    const to = anchor ? [anchor, hover || anchor].sort()[1] : committed.to;
    grid.querySelectorAll('[data-date]').forEach(cell => {
      const value = cell.dataset.date, selected = value >= from && value <= to;
      cell.classList.toggle('in-range', selected);
      cell.classList.toggle('range-start', value === from);
      cell.classList.toggle('range-end', value === to);
      cell.setAttribute('aria-selected', String(selected));
    });
    caption.textContent = anchor ? 'Select an end date' : 'Select a preset or choose a start and end date';
  }
  function render(focus = false) {
    const current = today();
    presetsNode.replaceChildren();
    datePresets(current, earliest()).forEach(preset => {
      const control = node('button', 'range-preset'); control.type = 'button'; control.dataset.preset = preset.id;
      control.setAttribute('aria-pressed', String(!anchor && preset.id === committed.id));
      const crossesYear = preset.from.slice(0, 4) !== current.slice(0, 4) || preset.to.slice(0, 4) !== current.slice(0, 4);
      control.append(node('span', 'range-preset-name', preset.label), node('span', 'range-preset-dates', rangeLabel(preset.from, preset.to, crossesYear)));
      control.addEventListener('click', () => commit(preset.from, preset.to, preset.id)); presetsNode.append(control);
    });
    root.querySelector('[data-range-month]').textContent = format(month, { month: 'long' });
    root.querySelector('[data-range-year]').textContent = month.slice(0, 4);
    root.querySelector('[data-range-next-month]').disabled = monthStart(month, 1) > monthStart(current);
    root.querySelector('[data-range-next-year]').disabled = Number(month.slice(0, 4)) >= Number(current.slice(0, 4));
    root.querySelector('[data-range-prev-year]').disabled = Number(month.slice(0, 4)) <= 1970;
    root.querySelector('[data-range-prev-month]').disabled = month <= '1970-01-01';
    const values = calendarDays(month);
    if (!values.includes(focusDay) || focusDay > current) focusDay = month > current ? current : month;
    grid.replaceChildren();
    for (let week = 0; week < 6; week++) {
      const row = node('div', 'range-week'); row.setAttribute('role', 'row');
      values.slice(week * 7, week * 7 + 7).forEach(value => {
        const cell = node('button', 'range-day', Number(value.slice(-2))); cell.type = 'button'; cell.dataset.date = value;
        cell.setAttribute('role', 'gridcell'); cell.setAttribute('aria-label', format(value, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
        cell.classList.toggle('outside-month', value.slice(0, 7) !== month.slice(0, 7));
        if (value === current) cell.setAttribute('aria-current', 'date');
        cell.disabled = value > current || value < '1970-01-01';
        cell.tabIndex = value === focusDay && !cell.disabled ? 0 : -1;
        cell.addEventListener('click', () => {
          focusDay = value;
          if (!anchor) { anchor = value; hover = value; render(true); }
          else { const [from, to] = [anchor, value].sort(); commit(from, to); }
        });
        cell.addEventListener('pointerenter', () => { if (anchor && !cell.disabled) { hover = value; paintSelection(); } });
        cell.addEventListener('focus', () => { focusDay = value; if (anchor) { hover = value; paintSelection(); } });
        row.append(cell);
      }); grid.append(row);
    }
    paintSelection();
    if (focus) grid.querySelector(`[data-date="${focusDay}"]`)?.focus({ preventScroll: true });
  }
  function position() {
    const box = trigger.getBoundingClientRect();
    const below = window.innerHeight - box.bottom - 18, above = box.top - 18;
    const upward = below < 320 && above > below;
    popup.style.top = upward ? 'auto' : 'calc(100% + 9px)';
    popup.style.bottom = upward ? 'calc(100% + 9px)' : 'auto';
    popup.style.maxHeight = `${Math.max(160, upward ? above : below)}px`;
  }
  window.addEventListener('resize', () => { if (open) position(); });
  function close(restore = false) {
    if (!open) return;
    open = false; popup.hidden = true; trigger.setAttribute('aria-expanded', 'false'); anchor = null; hover = null;
    if (restore) trigger.focus({ preventScroll: true });
  }
  trigger.addEventListener('click', () => {
    if (open) { close(true); return; }
    open = true; month = monthStart(committed.from); focusDay = committed.from; anchor = null;
    popup.hidden = false; trigger.setAttribute('aria-expanded', 'true'); position(); render();
    (presetsNode.querySelector('[aria-pressed="true"]') || grid.querySelector('[tabindex="0"]'))?.focus({ preventScroll: true });
  });
  function moveMonth(amount) {
    const next = monthStart(month, amount);
    month = next > monthStart(today()) ? monthStart(today()) : next < '1970-01-01' ? '1970-01-01' : next;
    focusDay = month; hover = null; render();
  }
  root.querySelector('[data-range-prev-month]').addEventListener('click', () => moveMonth(-1));
  root.querySelector('[data-range-next-month]').addEventListener('click', () => moveMonth(1));
  root.querySelector('[data-range-prev-year]').addEventListener('click', () => moveMonth(-12));
  root.querySelector('[data-range-next-year]').addEventListener('click', () => moveMonth(12));
  grid.addEventListener('pointerleave', () => { hover = null; paintSelection(); });
  grid.addEventListener('keydown', event => {
    const focused = event.target.closest('[data-date]'); if (!focused) return;
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    let next;
    if (delta) next = shiftDays(focused.dataset.date, delta);
    if (event.key === 'Home') next = shiftDays(focused.dataset.date, -date(focused.dataset.date).getUTCDay());
    if (event.key === 'End') next = shiftDays(focused.dataset.date, 6 - date(focused.dataset.date).getUTCDay());
    if (event.key === 'PageUp' || event.key === 'PageDown') next = monthStart(focused.dataset.date, (event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1));
    if (!next) return;
    event.preventDefault(); focusDay = next > today() ? today() : next < '1970-01-01' ? '1970-01-01' : next;
    month = monthStart(focusDay); render(true);
  });
  document.addEventListener('pointerdown', event => { if (open && !root.contains(event.target)) close(); });
  document.addEventListener('focusin', event => { if (open && !root.contains(event.target)) close(); });
  root.addEventListener('keydown', event => { if (open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); } });
  root.querySelector('#date-from').value = committed.from; root.querySelector('#date-to').value = committed.to;
  root.querySelector('[data-range-label]').textContent = rangeLabel(committed.from, committed.to, true);
  trigger.setAttribute('aria-label', `Date range: ${rangeLabel(committed.from, committed.to, true)}. Change date range`);
  trigger.disabled = false;
  return { close, get value() { return { ...committed }; } };
}
