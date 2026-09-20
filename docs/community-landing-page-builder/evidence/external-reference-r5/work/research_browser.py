import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright


ROOT = Path(__file__).resolve().parent
SITES = {
    "client": "https://gardenroomco.com/",
    "reference": "https://www.greenretreats.co.uk/",
}


async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            headless=True,
            executable_path="/Users/mac/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell",
        )
        findings = {}
        for name, url in SITES.items():
            findings[name] = []
            for width, height in ((390, 844), (1440, 900)):
                context = await browser.new_context(
                    viewport={"width": width, "height": height},
                    reduced_motion="reduce",
                    service_workers="block",
                )
                await context.route(
                    "**/*",
                    lambda route: route.continue_()
                    if route.request.method in ("GET", "HEAD", "OPTIONS")
                    else route.abort(),
                )
                page = await context.new_page()
                response = await page.goto(url, wait_until="domcontentloaded", timeout=45000)
                await page.wait_for_timeout(2500)
                result = await page.evaluate(
                    """() => {
                      const sample = selector => [...document.querySelectorAll(selector)].find(el => {
                        const r = el.getBoundingClientRect();
                        const s = getComputedStyle(el);
                        return el.textContent.trim().length > 30 && r.width > 0 && r.height > 0 && s.visibility !== 'hidden';
                      });
                      const describe = el => el ? ({
                        text: el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 150),
                        tag: el.tagName.toLowerCase(),
                        className: el.className,
                        family: getComputedStyle(el).fontFamily,
                        weight: getComputedStyle(el).fontWeight,
                        size: getComputedStyle(el).fontSize,
                        color: getComputedStyle(el).color
                      }) : null;
                      return {
                        title: document.title,
                        heading: describe(document.querySelector('h1')),
                        body: describe(sample('main p, article p, p')),
                        fonts: [...document.fonts].map(f => ({family:f.family,status:f.status})),
                        fontResources: performance.getEntriesByType('resource').map(r => r.name).filter(n => /\\.(woff2?|ttf)(\\?|$)/.test(n)),
                        images: [...document.images].filter(i => i.getBoundingClientRect().top < innerHeight).slice(0,8).map(i => ({src:i.currentSrc,alt:i.alt,loaded:i.complete && i.naturalWidth > 0}))
                      };
                    }"""
                )
                result["status"] = response.status if response else None
                result["url"] = page.url
                result["viewport"] = [width, height]
                screenshot = ROOT / "public-source" / f"{name}-{width}.png"
                await page.screenshot(path=str(screenshot), full_page=True, animations="disabled")
                findings[name].append(result)
                await context.close()
        await browser.close()
        (ROOT / "public-source" / "rendered-brand.json").write_text(json.dumps(findings, indent=2))
        print(json.dumps(findings, indent=2))


asyncio.run(main())
