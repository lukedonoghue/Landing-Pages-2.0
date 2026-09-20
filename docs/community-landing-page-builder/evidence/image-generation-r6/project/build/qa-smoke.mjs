import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';

const baseUrl = process.argv[2] || 'http://127.0.0.1:59628/';
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const findings = [];
const check = (name, passed, detail) => findings.push({ name, passed, detail });

try {
  const page = await browser.newPage({ viewport: { width: 320, height: 700 }, reducedMotion: 'reduce' });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'project/build/screenshots/320x700-first.png' });
  const narrow = await page.evaluate(() => {
    const hero = document.querySelector('.hero').getBoundingClientRect();
    const facts = document.querySelector('.facts').getBoundingClientRect();
    const cta = document.querySelector('.hero [data-primary-action]').getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      heroBottom: hero.bottom,
      factsVisible: facts.top < innerHeight,
      ctaVisible: cta.top >= 0 && cta.bottom <= innerHeight,
      ctaWidth: cta.width,
    };
  });
  check('320px first screen', !narrow.overflow && narrow.factsVisible && narrow.ctaVisible, narrow);

  const links = await page.locator('[data-primary-action]').evaluateAll((elements) => elements.map((el) => ({
    label: el.childNodes[0]?.textContent.trim(),
    href: el.getAttribute('href'),
  })));
  check('quote action parity', links.length === 4 && links.every((link) => link.label === 'Request your fixed-fee quote' && link.href === 'mailto:info@clarentis.co.uk?subject=Fixed-fee%20quote%20request'), links);
  const phones = await page.locator('a[href^="tel:"]').evaluateAll((elements) => elements.map((el) => ({ href: el.getAttribute('href'), text: el.textContent.trim() })));
  check('phone destinations', phones.length === 2 && phones.every((link) => link.href === 'tel:+447467474356' && link.text.includes('07467 474356')), phones);

  await page.locator('.mobile-nav summary').focus();
  await page.keyboard.press('Enter');
  check('mobile menu opens by keyboard', await page.locator('.mobile-nav').evaluate((el) => el.open), 'Enter opens details');
  await page.locator('.mobile-nav nav a[href="#fees"]').click();
  check('mobile menu closes after navigation', !(await page.locator('.mobile-nav').evaluate((el) => el.open)) && new URL(page.url()).hash === '#fees', page.url());

  await page.locator('.faq-list summary').first().click();
  check('FAQ expands', await page.locator('.faq-list details').first().evaluate((el) => el.open), 'First answer visible');
  await page.screenshot({ path: 'project/build/screenshots/320x700-faq-open.png', fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  const keyboardFocus = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    visible: document.activeElement?.matches(':focus-visible'),
    outline: getComputedStyle(document.activeElement).outlineWidth,
  }));
  check('keyboard focus visible', keyboardFocus.tag === 'A' && keyboardFocus.visible && keyboardFocus.outline !== '0px', keyboardFocus);

  for (const image of await page.locator('img').all()) {
    await image.scrollIntoViewIfNeeded();
    await image.evaluate((el) => el.decode().catch(() => {}));
  }
  const images = await page.locator('img').evaluateAll((elements) => elements.map((el) => ({
    src: el.currentSrc,
    loaded: el.complete && el.naturalWidth > 0,
    role: el.dataset.imageRole,
  })));
  check('all images loaded', images.length === 5 && images.every((image) => image.loaded && image.role), images);
  check('four distinct content images', new Set(images.filter((image) => image.role === 'illustrative').map((image) => image.src)).size === 4, images);
  check('visible image disclosures', await page.locator('figure figcaption').count() === 4, 'One caption per illustrative image');
} finally {
  await browser.close();
}

const report = { checkedAt: new Date().toISOString(), baseUrl, passed: findings.every((item) => item.passed), findings, limit: 'mailto and tel targets were inspected locally; no email app was launched and no live message or call was made.' };
await writeFile('project/build/interaction-review.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ passed: report.passed, findings: findings.map(({ name, passed }) => ({ name, passed })) }, null, 2));
if (!report.passed) process.exitCode = 1;
