const SVG_NS = 'http://www.w3.org/2000/svg';
let chartSequence = 0;

function svgNode(tag, attributes = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = String(text);
  return node;
}
function htmlNode(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}
function count(value) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : 0; }
function dateLabel(value, full = false, year = false) {
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', ...(full ? { weekday: 'long', year: 'numeric' } : year ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(date);
}
function rateLabel(day) { return day.visitors > 0 ? `${(day.conversions / day.visitors * 100).toFixed(1)}%` : '-'; }
function numberLabel(value) { return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value); }

/**
 * Replace root contents with an accessible daily SVG chart and an exact-day tooltip.
 * days: [{ date: 'YYYY-MM-DD', visitors, conversions, leads, conversion_rate }].
 * mode: 'count' (default) or 'rate'; visitorLabel controls the tooltip/summary label.
 * Rates are calculated from each day's selected visitor and conversion counts.
 * Call again after resizing or changing filters. No document/window listeners remain.
 */
export function renderPerformanceChart(root, days, { mode = 'count', visitorLabel = 'Visitors' } = {}) {
  root.replaceChildren();
  root.classList.add('performance-chart');
  const data = (Array.isArray(days) ? days : []).map(day => ({ date: String(day.date || ''), visitors: count(day.visitors), conversions: count(day.conversions) }));
  if (!data.length) {
    root.append(htmlNode('p', 'performance-chart-empty', 'Activity will appear after the first measured visit.'));
    return;
  }
  const isRate = mode === 'rate';
  const frame = htmlNode('div', 'performance-chart-frame');
  root.append(frame);
  const width = Math.max(220, frame.clientWidth || root.clientWidth || 600);
  const height = width <= 560 ? 200 : 240;
  const inset = { left: isRate ? 48 : 40, right: 10, top: 18, bottom: 34 };
  const plotWidth = width - inset.left - inset.right;
  const plotHeight = height - inset.top - inset.bottom;
  const baseline = height - inset.bottom;
  const value = day => isRate ? (day.visitors > 0 ? day.conversions / day.visitors * 100 : null) : day.visitors;
  let maximum = 0;
  for (const day of data) maximum = Math.max(maximum, value(day) || 0, isRate ? 0 : day.conversions);
  const desiredStep = (maximum || (isRate ? 100 : 4)) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(desiredStep));
  const multiplier = [1, 2, 2.5, 5, 10].find(n => n * magnitude >= desiredStep) || 10;
  const step = isRate ? multiplier * magnitude : Math.max(1, Math.ceil(multiplier * magnitude));
  const ceiling = Math.max(step, Math.ceil((maximum || (isRate ? 100 : 4)) / step) * step);
  const xAt = index => inset.left + (data.length === 1 ? plotWidth / 2 : index / (data.length - 1) * plotWidth);
  const yAt = number => baseline - number / ceiling * plotHeight;
  const id = `performance-chart-${++chartSequence}`;
  const svg = svgNode('svg', { class: 'performance-chart-svg', viewBox: `0 0 ${width} ${height}`, role: 'img', tabindex: '0', 'aria-labelledby': `${id}-title`, 'aria-describedby': `${id}-description` });
  svg.style.height = `${height}px`;
  svg.append(svgNode('title', { id: `${id}-title` }, isRate ? 'Daily conversion rate' : `Daily ${visitorLabel.toLowerCase()} and conversions`));
  svg.append(svgNode('desc', { id: `${id}-description` }, `${data.length} ${data.length === 1 ? 'day' : 'days'}, ${dateLabel(data[0].date, false, true)}${data.length > 1 ? ` to ${dateLabel(data.at(-1).date, false, true)}` : ''}. Use the left and right arrow keys to inspect each day, or Home and End. Exact values are also in the daily table below.${isRate ? ' Days with no measured visitors have no conversion rate.' : ''}`));
  frame.append(svg);
  const axis = svgNode('g', { class: 'performance-axis', 'aria-hidden': 'true' });
  svg.append(axis);
  for (let n = 0; n <= Math.round(ceiling / step); n++) {
    const number = n * step;
    const y = yAt(number);
    axis.append(svgNode('line', { x1: inset.left, x2: width - inset.right, y1: y, y2: y, class: n ? 'performance-grid-line' : 'performance-baseline' }));
    axis.append(svgNode('text', { x: inset.left - 10, y: y + 4, 'text-anchor': 'end' }, `${numberLabel(number)}${isRate ? '%' : ''}`));
  }
  const tickCount = Math.min(data.length, Math.max(2, Math.floor(plotWidth / 125) + 1));
  const tickIndexes = data.length === 1 ? [0] : [...new Set(Array.from({ length: tickCount }, (_, i) => Math.round(i * (data.length - 1) / (tickCount - 1))))];
  const crossesYear = data[0].date.slice(0, 4) !== data.at(-1).date.slice(0, 4);
  for (const index of tickIndexes) {
    const anchor = data.length === 1 ? 'middle' : index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle';
    axis.append(svgNode('text', { x: xAt(index), y: height - 9, 'text-anchor': anchor, class: 'performance-date-label' }, dateLabel(data[index].date, false, crossesYear || index === 0)));
  }
  function drawSeries(getValue, className) {
    // A handful of SVG paths hold all dates, so multi-year ranges avoid thousands of DOM nodes.
    // Null rates split the line: days with no visitors must never imply a measured 0% rate.
    let segment = [];
    function finish() {
      if (!segment.length) return;
      if (segment.length === 1) {
        svg.append(svgNode('circle', { cx: segment[0][0], cy: segment[0][1], r: 3, class: `performance-single-point ${className}` }));
      } else {
        const line = segment.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
        const area = `${line} L${segment.at(-1)[0].toFixed(2)},${baseline} L${segment[0][0].toFixed(2)},${baseline} Z`;
        svg.append(svgNode('path', { d: area, class: `performance-area ${className}` }));
        svg.append(svgNode('path', { d: line, class: `performance-line ${className}`, fill: 'none', 'vector-effect': 'non-scaling-stroke' }));
      }
      segment = [];
    }
    data.forEach((day, index) => { const number = getValue(day); if (number === null) finish(); else segment.push([xAt(index), yAt(number)]); });
    finish();
  }
  drawSeries(value, 'performance-visitors');
  if (!isRate) drawSeries(day => day.conversions, 'performance-conversions');
  const marker = svgNode('g', { class: 'performance-marker', visibility: 'hidden', 'aria-hidden': 'true' });
  const crosshair = svgNode('line', { y1: inset.top, y2: baseline, class: 'performance-crosshair' });
  const firstPoint = svgNode('circle', { r: 3.5, class: 'performance-hover-point performance-visitors' });
  const secondPoint = svgNode('circle', { r: 3.5, class: 'performance-hover-point performance-conversions' });
  marker.append(crosshair, firstPoint);
  if (!isRate) marker.append(secondPoint);
  svg.append(marker);
  const tooltip = htmlNode('div', 'performance-tooltip');
  tooltip.hidden = true;
  tooltip.setAttribute('aria-hidden', 'true');
  const heading = htmlNode('p', 'performance-tooltip-date');
  const rows = htmlNode('div', 'performance-tooltip-rows');
  tooltip.append(heading, rows);
  frame.append(tooltip);
  const details = htmlNode('p', 'performance-chart-sr');
  details.setAttribute('role', 'status');
  details.setAttribute('aria-live', 'polite');
  details.setAttribute('aria-atomic', 'true');
  frame.append(details);
  let selected = 0;
  function hide() { tooltip.hidden = true; marker.setAttribute('visibility', 'hidden'); }
  function show(index) {
    selected = Math.max(0, Math.min(data.length - 1, index));
    const day = data[selected];
    const x = xAt(selected);
    marker.setAttribute('visibility', 'visible');
    crosshair.setAttribute('x1', String(x)); crosshair.setAttribute('x2', String(x));
    const firstValue = value(day);
    firstPoint.setAttribute('visibility', firstValue === null ? 'hidden' : 'visible');
    firstPoint.setAttribute('cx', String(x)); firstPoint.setAttribute('cy', String(yAt(firstValue || 0)));
    secondPoint.setAttribute('cx', String(x)); secondPoint.setAttribute('cy', String(yAt(day.conversions)));
    heading.textContent = dateLabel(day.date, true);
    rows.replaceChildren();
    for (const [label, text, series] of [[visitorLabel, numberLabel(day.visitors), 'visitors'], ['Conversions', numberLabel(day.conversions), 'conversions'], ['Conversion rate', rateLabel(day), 'rate']]) {
      const row = htmlNode('div', 'performance-tooltip-row');
      row.append(htmlNode('span', `performance-tooltip-key performance-tooltip-key-${series}`), htmlNode('span', '', label), htmlNode('strong', '', text));
      rows.append(row);
    }
    tooltip.dataset.date = day.date;
    tooltip.hidden = false;
    const left = x + 16 + tooltip.offsetWidth <= width ? x + 16 : x - tooltip.offsetWidth - 16;
    tooltip.style.left = `${Math.max(4, Math.min(left, width - tooltip.offsetWidth - 4))}px`;
    tooltip.style.top = `${inset.top}px`;
    details.textContent = `${dateLabel(day.date, true)}. ${visitorLabel}: ${numberLabel(day.visitors)}. Conversions: ${numberLabel(day.conversions)}. Conversion rate: ${day.visitors ? rateLabel(day) : 'not available, no measured visitors'}.`;
  }
  function inspectPointer(event) {
    const bounds = svg.getBoundingClientRect();
    if (!bounds.width) return;
    const x = (event.clientX - bounds.left) / bounds.width * width;
    show(data.length === 1 ? 0 : Math.round((x - inset.left) / plotWidth * (data.length - 1)));
  }
  svg.addEventListener('pointermove', inspectPointer);
  svg.addEventListener('pointerdown', inspectPointer);
  svg.addEventListener('pointerleave', () => { if (document.activeElement !== svg) hide(); });
  svg.addEventListener('focus', () => show(selected));
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', event => {
    if (event.key === 'Escape') { hide(); return; }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    show(event.key === 'Home' ? 0 : event.key === 'End' ? data.length - 1 : selected + (event.key === 'ArrowRight' ? 1 : -1));
  });
}
