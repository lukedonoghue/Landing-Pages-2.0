import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const out = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const results = [];
try {
  for (const [label, url] of [
    ['business', 'https://gardenroomco.com/'],
    ['presentation-example', 'https://www.greenretreats.co.uk/'],
  ]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(out, `${label}-live-first.png`) });
      const details = await page.evaluate(() => {
        const visible = selector => [...document.querySelectorAll(selector)].find(element => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden';
        });
        const heading = visible('h1') || visible('h2');
        const paragraph = [...document.querySelectorAll('p')].find(element => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && element.innerText.trim().length > 40;
        });
        return {
          title: document.title,
          heading: heading ? { text: heading.innerText.slice(0, 180), font: getComputedStyle(heading).fontFamily } : null,
          paragraph: paragraph ? { text: paragraph.innerText.slice(0, 180), font: getComputedStyle(paragraph).fontFamily } : null,
        };
      });
      results.push({ label, url, status: response.status(), ...details });
    } catch (error) {
      results.push({ label, url, error: error.message });
    }
    await context.close();
  }
  fs.writeFileSync(path.join(out, 'source-comparison.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
