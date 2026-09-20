import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const out = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4199/', { waitUntil: 'domcontentloaded' });
  await page.locator('.menu-toggle').click();
  const menuOpened = await page.locator('.menu-toggle').getAttribute('aria-expanded') === 'true' && await page.locator('#main-nav').isVisible();
  await page.locator('#main-nav a[href="#projects"]').click();
  const projectsLink = page.url().endsWith('#projects') && await page.locator('.menu-toggle').getAttribute('aria-expanded') === 'false';
  await page.locator('.hero .button').click();
  const primaryAction = page.url().endsWith('#enquire') && await page.locator('#enquiry-form').isVisible();
  await page.locator('#questions summary').first().click();
  const faqOpened = await page.locator('#questions details').first().getAttribute('open') !== null;
  await page.locator('#questions summary').first().click();
  const faqClosed = await page.locator('#questions details').first().getAttribute('open') === null;
  const links = await page.evaluate(() => ({
    projects: [...document.querySelectorAll('.project-caption a')].map(link => link.href),
    faq: document.querySelector('.materials .text-link').href,
    privacy: document.querySelector('.privacy-note a').href,
    phone: document.querySelector('.enquiry-aside a').href,
  }));
  const result = { menuOpened, projectsLink, primaryAction, faqOpened, faqClosed, links };
  fs.writeFileSync(path.join(out, 'controls.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await context.close();
} finally {
  await browser.close();
}
