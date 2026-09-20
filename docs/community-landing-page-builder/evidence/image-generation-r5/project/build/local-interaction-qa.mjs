import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 320, height: 700 }, reducedMotion: 'reduce' });
const base = 'http://127.0.0.1:53621/';
const report = { url: base, viewport: '320x700', checks: {}, findings: [] };

try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'project/build/screenshots/320x700-first.png' });
  await page.screenshot({ path: 'project/build/screenshots/320x700-landing.png', fullPage: true });

  const geometry = await page.evaluate(() => {
    const box = selector => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    return { viewportWidth: innerWidth, scrollWidth: document.documentElement.scrollWidth, hero: box('.hero'), photo: box('.hero-media'), next: box('.fit-strip'), h1: box('h1'), primary: box('.hero-actions [data-primary-action]') };
  });
  report.checks.geometry = geometry;
  assert.ok(geometry.scrollWidth <= 320, '320px horizontal overflow');
  assert.ok(geometry.primary.top >= 0 && geometry.primary.bottom <= 700, '320px primary action is off screen');
  assert.ok(geometry.photo.height >= 140, '320px hero photo is too small');

  const actionData = await page.locator('[data-primary-action]').evaluateAll(links => links.map(link => ({ text: link.textContent.trim(), href: link.href })));
  report.checks.primaryActions = actionData;
  assert.ok(actionData.length >= 3, 'Missing primary entry points');
  assert.ok(actionData.every(action => action.text === 'Request your fixed-fee quote' && action.href.startsWith('mailto:info@clarentis.co.uk?subject=Fixed-fee%20quote%20enquiry')), 'Primary CTA text or email destination differs');

  const phones = await page.locator('a[href^="tel:"]').evaluateAll(links => links.map(link => ({ text: link.textContent.trim(), href: link.href })));
  report.checks.phones = phones;
  assert.ok(phones.length >= 2 && phones.every(phone => phone.href === 'tel:+447467474356'), 'Phone destination differs');

  await page.keyboard.press('Tab');
  report.checks.firstKeyboardTarget = await page.evaluate(() => document.activeElement?.textContent?.trim());
  assert.equal(report.checks.firstKeyboardTarget, 'Skip to content');

  await page.locator('.mobile-nav summary').click();
  report.checks.menuOpen = await page.locator('.mobile-nav').evaluate(element => element.open);
  assert.equal(report.checks.menuOpen, true);
  await page.locator('.mobile-nav a[href="#fees"]').click();
  report.checks.menuDestination = new URL(page.url()).hash;
  assert.equal(report.checks.menuDestination, '#fees');

  await page.locator('.faq-list summary').first().click();
  report.checks.faqOpen = await page.locator('.faq-list details').first().evaluate(element => element.open);
  assert.equal(report.checks.faqOpen, true);
  report.status = 'pass';
} catch (error) {
  report.status = 'blocked';
  report.findings.push(error.message);
} finally {
  await writeFile('project/build/local-interaction-qa.json', JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}

console.log(JSON.stringify({ status: report.status, findings: report.findings, geometry: report.checks.geometry }, null, 2));
if (report.status !== 'pass') process.exitCode = 1;
