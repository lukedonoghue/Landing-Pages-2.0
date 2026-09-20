import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright


ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / "project"
QA = PROJECT / "qa"
URL = "http://127.0.0.1:8787/"
CHROME = "/Users/mac/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell"
VIEWPORTS = [(390, 844), (768, 1024), (1024, 800), (1280, 600), (1440, 900), (320, 568)]


async def ready(page):
    await page.goto(URL, wait_until="networkidle")
    await page.evaluate("document.fonts.ready")


async def capture_page(browser, width, height):
    context = await browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce")
    page = await context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    await ready(page)
    await page.evaluate(
        """async () => {
          for (let y = 0; y < document.documentElement.scrollHeight; y += 600) {
            scrollTo(0, y);
            await new Promise(r => setTimeout(r, 45));
          }
          await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
          scrollTo(0, 0);
        }"""
    )
    await page.screenshot(path=str(QA / f"{width}x{height}-top.png"), full_page=False, animations="disabled")
    await page.screenshot(path=str(QA / f"{width}x{height}-full.png"), full_page=True, animations="disabled")
    metrics = await page.evaluate(
        """() => {
          const box = sel => { const r=document.querySelector(sel).getBoundingClientRect(); return {top:r.top,bottom:r.bottom,width:r.width,height:r.height}; };
          return {
            overflow: document.documentElement.scrollWidth - innerWidth,
            hero: box('.hero'), trust: box('.trust-bar'),
            h1Font: getComputedStyle(document.querySelector('h1')).fontFamily,
            bodyFont: getComputedStyle(document.querySelector('.hero__lead')).fontFamily,
            trustFont: getComputedStyle(document.querySelector('.trust-bar span')).fontSize,
            heroSource: document.querySelector('.hero__image img').currentSrc,
            missingImages: [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.getAttribute('src')),
            phoneVisible: [...document.querySelectorAll('.header-phone')].some(el => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0)
          };
        }"""
    )
    metrics["errors"] = errors
    metrics["viewport"] = [width, height]
    metrics["modal"] = []
    if width in (390, 1440):
        sections = {
            "ideas": "#possibilities", "projects": "#projects", "details": "#details",
            "process": "#process", "quote": ".quote-section", "voices": ".voices-section",
            "faq": "#faq", "final": ".final-cta", "footer": ".site-footer"
        }
        for name, selector in sections.items():
            await page.locator(selector).screenshot(path=str(QA / f"{width}-{name}.png"), animations="disabled")
    openers = page.locator("[data-open-modal]")
    for index in range(await openers.count()):
        button = openers.nth(index)
        if not await button.is_visible():
            continue
        await button.scroll_into_view_if_needed()
        before = await page.evaluate("scrollY")
        await button.click()
        opened = await page.locator("#enquiry-dialog").evaluate("el => el.open")
        after = await page.evaluate("scrollY")
        if index == 1:
            await page.screenshot(path=str(QA / f"{width}x{height}-modal.png"), animations="disabled")
            submit_box = await page.locator("#submit-enquiry").bounding_box()
            metrics["submitBox"] = submit_box
            metrics["tabFlow"] = []
            for _ in range(8):
                await page.keyboard.press("Tab")
                await page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
                metrics["tabFlow"].append(await page.evaluate(
                    """() => { const el=document.activeElement, r=el.getBoundingClientRect(), a=document.querySelector('.form-action').getBoundingClientRect();
                      const area=document.querySelector('.form-fields').getBoundingClientRect();
                      const group=el.closest('.field')?.getBoundingClientRect();
                      return {id:el.id || el.getAttribute('aria-label') || el.tagName, top:r.top, bottom:r.bottom,
                        groupTop:group?.top, groupBottom:group?.bottom, areaTop:area.top, areaBottom:area.bottom,
                        actionTop:a.top, inDialog:document.querySelector('#enquiry-dialog').contains(el)}; }"""
                ))
        await page.locator("[data-close-modal]").click()
        restored = await button.evaluate("el => document.activeElement === el")
        metrics["modal"].append({"index": index, "opened": opened, "scrollChange": after - before, "restoredFocus": restored})
    await context.close()
    return metrics


async def fill_valid(page):
    await page.locator("#name").fill("Synthetic Preview")
    await page.locator("#email").fill("gardenroom-test@example.invalid")
    await page.locator("#phone").fill("+44 7700 900123")
    await page.locator("#location").fill("Chester")
    await page.locator("#message").fill("A garden office with space for two desks and storage.")


async def conversion(browser, width, height):
    context = await browser.new_context(viewport={"width": width, "height": height})
    page = await context.new_page()
    await ready(page)
    await page.locator(".hero [data-open-modal]").click()
    await page.locator("#submit-enquiry").click()
    empty = await page.evaluate(
        """() => ({summary:!document.querySelector('#error-summary').hidden, focused:document.activeElement.id,
          errors:[...document.querySelectorAll('.field-error')].filter(el => el.textContent).map(el=>el.id)})"""
    )
    await page.screenshot(path=str(QA / f"{width}x{height}-validation.png"), animations="disabled")
    await page.locator("#name").fill("   ")
    await page.locator("#email").fill("bad")
    await page.locator("#phone").fill("abc123")
    await page.locator("#message").fill("   ")
    await page.locator("#submit-enquiry").click()
    malformed = await page.evaluate(
        """() => [...document.querySelectorAll('.field-error')].filter(el => el.textContent).map(el=>el.id)"""
    )
    await page.locator("#name").fill("Synthetic Preview")
    corrected = await page.evaluate(
        """() => ({nameError:document.querySelector('#name-error').textContent,
          summary:document.querySelector('#error-summary').textContent})"""
    )
    await page.locator("#error-summary a[href='#email']").click()
    link_focus = await page.evaluate("document.activeElement.id")
    await fill_valid(page)

    async def fail(route):
        await route.fulfill(status=503, content_type="application/json", body='{"confirmed":false}')

    await page.route("**/__preview/enquiry", fail)
    await page.locator("#submit-enquiry").click()
    await page.locator("#form-result").get_by_text("could not be confirmed", exact=False).wait_for()
    failure = await page.evaluate(
        """() => ({focused:document.activeElement.id, message:document.querySelector('#form-result').textContent,
          name:document.querySelector('#name').value})"""
    )
    await page.screenshot(path=str(QA / f"{width}x{height}-failure.png"), animations="disabled")
    await page.unroute("**/__preview/enquiry", fail)
    await page.locator("#submit-enquiry").click()
    await page.locator("#enquiry-success").wait_for(state="visible")
    success = await page.evaluate(
        """() => ({focused:document.activeElement.id, text:document.querySelector('#enquiry-success').textContent,
          formHidden:document.querySelector('#enquiry-content').hidden})"""
    )
    await page.screenshot(path=str(QA / f"{width}x{height}-success.png"), animations="disabled")
    await page.locator("[data-close-modal]").click()
    await page.locator(".hero [data-open-modal]").click()
    retained = await page.locator("#enquiry-success").is_visible()
    await page.locator("#new-enquiry").click()
    reset = await page.locator("#name").input_value()

    await fill_valid(page)
    gate = asyncio.Event()
    count = 0

    async def delayed(route):
        nonlocal count
        count += 1
        await gate.wait()
        await route.continue_()

    await page.route("**/__preview/enquiry", delayed)
    await page.locator("#submit-enquiry").click()
    await page.locator("#submit-enquiry").wait_for(state="visible")
    await page.evaluate("document.querySelector('#enquiry-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))")
    await asyncio.sleep(0.3)
    duplicate_count = count
    await page.locator("[data-close-modal]").click()
    await page.locator(".hero [data-open-modal]").click()
    pending_locked = await page.locator("#name").is_disabled()
    gate.set()
    await page.locator("#enquiry-success").wait_for(state="visible")
    await page.unroute("**/__preview/enquiry", delayed)

    await page.locator("#new-enquiry").click()
    await fill_valid(page)

    async def timeout(route):
        await asyncio.sleep(10)
        await route.abort()

    await page.route("**/__preview/enquiry", timeout)
    await page.locator("#submit-enquiry").click()
    await page.locator("#form-result").get_by_text("could not be confirmed", exact=False).wait_for(timeout=12000)
    deadline_recovered = await page.locator("#submit-enquiry").is_enabled()
    await page.unroute("**/__preview/enquiry", timeout)
    await context.close()
    return {"viewport": [width, height], "empty": empty, "malformed": malformed,
            "corrected": corrected, "summaryLinkFocus": link_focus,
            "failure": failure, "success": success, "retainedSuccess": retained,
            "newEnquiryName": reset, "duplicateRequestCount": duplicate_count,
            "pendingLockedOnReopen": pending_locked, "deadlineRecovered": deadline_recovered}


async def main():
    QA.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True, executable_path=CHROME)
        report = {"pages": [], "conversion": []}
        for width, height in VIEWPORTS:
            report["pages"].append(await capture_page(browser, width, height))
        for width, height in ((390, 844), (1440, 900)):
            report["conversion"].append(await conversion(browser, width, height))
        await browser.close()
    (PROJECT / "build" / "browser-review.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


asyncio.run(main())
