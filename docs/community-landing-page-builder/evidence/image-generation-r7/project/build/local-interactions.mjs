import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const buildDir = dirname(fileURLToPath(import.meta.url));
const shotDir = join(buildDir, 'screenshots');
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Users/mac/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell',
});
const result = { url: 'http://127.0.0.1:4189/', status: 'blocked', checks: [], screenshots: [], limits: [] };
const checked = (name, detail) => result.checks.push({ name, status: 'pass', detail });

try {
  await mkdir(shotDir, { recursive: true });
  for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    const response = await page.goto(result.url, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    const allCtas = await page.locator('[data-primary-action]').evaluateAll((nodes) => nodes.filter((node) => getComputedStyle(node).display !== 'none').map((node) => ({ text: node.textContent.trim(), href: node.getAttribute('href') })));
    assert.ok(allCtas.length >= 2);
    assert.ok(allCtas.every(({ text, href }) => text === 'Request your fixed-fee quote' && href === 'mailto:info@clarentis.co.uk?subject=Fixed-fee%20quote%20request'));
    checked(`quote destination ${viewport.width}`, `${allCtas.length} visible CTAs use the same direct email address and subject`);
    const phones = await page.locator('a[href^="tel:"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
    assert.ok(phones.length >= 3 && phones.every((href) => href === 'tel:+447467474356'));
    checked(`phone destination ${viewport.width}`, `${phones.length} links use the published number`);
    assert.equal(await page.locator('form').count(), 0);
    checked(`email-led source parity ${viewport.width}`, 'No mandatory data-entry form or on-site success claim');
    for (const image of await page.locator('main img').all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((node) => node.decode());
    }
    const images = await page.locator('main img').evaluateAll((nodes) => nodes.map((image) => ({ src: image.currentSrc, ok: image.complete && image.naturalWidth > 0 })));
    assert.equal(images.length, 4);
    assert.ok(images.every((item) => item.ok));
    checked(`illustrative images ${viewport.width}`, images.map((item) => item.src.split('/').at(-1)).join(', '));
    if (viewport.width === 390 || viewport.width === 1440) {
      const names = ['hero', 'bookkeeping', 'tax', 'consultation'];
      const figures = page.locator('figure.hero-media, figure.editorial-photo');
      assert.equal(await figures.count(), names.length);
      for (let index = 0; index < names.length; index += 1) {
        const figure = figures.nth(index);
        await figure.scrollIntoViewIfNeeded();
        const filename = `image-${names[index]}-${viewport.width}.png`;
        await figure.screenshot({ path: join(shotDir, filename) });
        result.screenshots.push(`build/screenshots/${filename}`);
      }
      checked(`image placements ${viewport.width}`, 'Four asset-specific rendered figure captures');
    }
    await page.evaluate(() => scrollTo(0, 0));
    if (viewport.width === 320) {
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(width <= 320);
      await page.screenshot({ path: join(shotDir, '320x700-first.png') });
      result.screenshots.push('build/screenshots/320x700-first.png');
      checked('320px first screen', 'No horizontal overflow; viewport screenshot captured');
    }
    if (viewport.width === 390) {
      await page.locator('.mobile-nav summary').click();
      assert.equal(await page.locator('.mobile-nav').getAttribute('open'), '');
      await page.screenshot({ path: join(shotDir, '390x844-menu.png') });
      result.screenshots.push('build/screenshots/390x844-menu.png');
      await page.locator('.mobile-nav nav a[href="#fees"]').click();
      assert.equal(new URL(page.url()).hash, '#fees');
      checked('mobile navigation', 'Menu opens and Fees link reaches its section');
      await page.locator('#questions details summary').first().click();
      assert.equal(await page.locator('#questions details').first().getAttribute('open'), '');
      await page.locator('#questions').scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(shotDir, '390x844-faq.png') });
      result.screenshots.push('build/screenshots/390x844-faq.png');
      checked('FAQ disclosure', 'First answer opens and is present in the mobile viewport');
    }
    if (viewport.width === 1440) {
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement?.className), 'skip-link');
      checked('keyboard start', 'Skip link receives first keyboard focus');
      const unknown = await page.locator('a[href]').evaluateAll((nodes) => nodes.filter((node) => node.getAttribute('href') === '#' || node.getAttribute('href') === '').length);
      assert.equal(unknown, 0);
      checked('destination placeholders', 'No empty or # links');
    }
    await page.close();
  }
  result.status = 'pass';
  result.limits.push('Email links were checked in-browser without opening a private email application or sending a message.');
} catch (error) {
  result.failure = error.stack || error.message;
} finally {
  await browser.close();
}

await writeFile(join(buildDir, 'interaction-review.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: result.status, checks: result.checks.length, failure: result.failure || null }));
if (result.status !== 'pass') process.exitCode = 1;
