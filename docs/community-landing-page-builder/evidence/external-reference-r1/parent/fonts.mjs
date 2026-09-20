import { writeFile } from 'node:fs/promises';
import { chromium } from '../../runs/external-reference-r1/qa-tools/node_modules/playwright/index.mjs';
import { readRenderedFonts } from '../../runs/external-reference-r1/skill/scripts/rendered_fonts.mjs';
const browser = await chromium.launch({ headless: true });
const rows = [];
try {
  for (const width of [390, 1440]) for (const url of ['https://gardenroomco.com/', 'http://127.0.0.1:52843/']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    await context.route('**/*', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    const samples = await page.evaluate(() => {
      const visible = e => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && b.top < innerHeight && s.visibility !== 'hidden' && +s.opacity > 0; };
      const result = {};
      for (const [role, query] of Object.entries({ heading: 'h1,h2', body: 'p' })) {
        const e = [...document.querySelectorAll(query)].find(e => visible(e) && e.textContent.trim().length > 25);
        if (e) result[role] = { selector: e.id ? '#' + CSS.escape(e.id) : e.tagName.toLowerCase(), text: e.textContent.trim().replace(/\s+/g, ' ').slice(0, 180), fontFamily: getComputedStyle(e).fontFamily };
      }
      return result;
    });
    rows.push({ url, width, samples, rendered: await readRenderedFonts(page, samples) });
    await context.close();
  }
  await writeFile(new URL('fonts.json', import.meta.url), JSON.stringify(rows, null, 2) + '\n');
  console.log(JSON.stringify(rows, null, 2));
} finally { await browser.close(); }
