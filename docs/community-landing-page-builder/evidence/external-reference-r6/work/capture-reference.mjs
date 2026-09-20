import { chromium } from 'playwright-core';

const chrome = '/Users/mac/.cache/puppeteer/chrome/mac_arm-138.0.7204.168/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ headless: true, executablePath: chrome });
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('https://www.greenretreats.co.uk/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const consent = page.getByRole('button', { name: 'Accept All', exact: true });
  if (await consent.count() === 1 && await consent.isVisible()) await consent.click();
  await page.evaluate(async () => {
    await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 5000))]);
    for (let y = 0; y < Math.min(document.body.scrollHeight, 18000); y += 600) {
      scrollTo(0, y);
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    scrollTo(0, 0);
  });
  await page.screenshot({ path: new URL(`source/reference-${viewport.width}x${viewport.height}-full.png`, import.meta.url).pathname, fullPage: true, animations: 'disabled' });
  await context.close();
}
await browser.close();
