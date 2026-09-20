"""Browser checks for the local preview. Uses synthetic data only."""

from pathlib import Path
import json

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "build" / "screenshots"
SHOTS.mkdir(exist_ok=True)
BASE = "http://127.0.0.1:4199/"
SIZES = [(390, 844), (768, 1024), (1024, 800), (1280, 600), (1440, 900)]
checks = []


def check(label, condition):
    checks.append({"check": label, "pass": bool(condition)})
    if not condition:
        raise AssertionError(label)


def fill_valid(page):
    page.locator("#name").fill("Local Preview Test")
    page.locator("#email").fill("preview@example.test")
    page.locator("#phone").fill("+44 7700 900123")
    page.locator("#message").fill("A small garden office with room for storage.")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        headless=True,
    )
    for width, height in SIZES:
        page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
        page.goto(BASE, wait_until="networkidle")
        page.screenshot(path=str(SHOTS / f"{width}x{height}-first-screen.png"))
        geometry = page.evaluate("""() => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          heroBottom: document.querySelector('.hero').getBoundingClientRect().bottom,
          railTop: document.querySelector('.evidence').getBoundingClientRect().top,
          cta: (() => { const r = document.querySelector('.hero [data-primary-action]').getBoundingClientRect(); return {top:r.top,bottom:r.bottom}; })(),
          images: [...document.images].filter(image => image.loading !== 'lazy' && (!image.complete || !image.naturalWidth)).length
        })""")
        check(f"{width}x{height} has no horizontal overflow", not geometry["overflow"])
        check(f"{width}x{height} has loaded images", geometry["images"] == 0)
        check(f"{width}x{height} hero action visible", 0 <= geometry["cta"]["top"] and geometry["cta"]["bottom"] <= height)
        check(f"{width}x{height} next section begins in viewport", geometry["railTop"] < height)
        page.close()

    page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    page.goto(BASE + "?preview=fail", wait_until="networkidle")
    page.locator(".hero [data-primary-action]").click()
    check("hero action reaches the single enquiry form", page.locator("#enquiry-form").is_visible())
    page.locator("#enquiry-form [type=submit]").click()
    check("blank submit focuses name", page.evaluate("document.activeElement.id") == "name")
    check("blank submit shows three required errors", page.locator("#error-summary li").count() == 3)
    page.locator("#name").fill("   ")
    page.locator("#email").fill("bad@")
    page.locator("#phone").fill("abcxyz")
    page.locator("#message").fill("   ")
    page.locator("#enquiry-form [type=submit]").click()
    check("whitespace and malformed contact values rejected", page.locator("#error-summary li").count() == 4)
    page.screenshot(path=str(SHOTS / "390x844-form-validation.png"))
    page.locator("#name").fill("Local Preview Test")
    check("corrected field clears from summary", page.locator("#error-summary li").count() == 3 and page.locator("#name-error").inner_text() == "")
    page.locator("#error-summary a[href='#phone']").press("Enter")
    check("summary link focuses the phone control", page.evaluate("document.activeElement.id") == "phone")
    page.locator("#email").fill("preview@example.test")
    page.locator("#phone").fill("+44 7700 900123")
    page.locator("#message").fill("A small garden office with room for storage.")
    check("all corrected errors clear", page.locator("#error-summary").is_hidden())
    page.locator("#enquiry-form [type=submit]").click()
    page.locator("#form-result").get_by_text("We could not confirm", exact=False).wait_for()
    check("failure keeps fields available", page.locator("#name").input_value() == "Local Preview Test" and page.locator("#name").is_enabled())
    check("failure moves focus to visible message", page.evaluate("""() => {
      const e=document.querySelector('#form-result'), r=e.getBoundingClientRect();
      return document.activeElement===e && r.top>=0 && r.bottom<=innerHeight;
    }"""))
    page.screenshot(path=str(SHOTS / "390x844-form-failure.png"))
    page.evaluate("history.replaceState(null, '', '/')")
    page.locator("#enquiry-form [type=submit]").click()
    page.locator("#success-panel").wait_for(state="visible")
    check("synthetic receiver confirms success", page.locator("#enquiry-form").is_hidden() and "No enquiry was sent" in page.locator("#success-panel").inner_text())
    check("success has visible focus", page.evaluate("document.activeElement.id") == "success-panel")
    page.screenshot(path=str(SHOTS / "390x844-form-success.png"))
    page.locator("#new-enquiry").click()
    check("new enquiry resets the form", page.locator("#enquiry-form").is_visible() and page.locator("#name").input_value() == "")
    page.reload(wait_until="networkidle")
    check("refresh does not create a conversion", page.locator("#success-panel").is_hidden())
    page.locator(".menu-toggle").click()
    check("mobile menu opens", page.locator("#main-nav").is_visible() and page.locator(".menu-toggle").get_attribute("aria-expanded") == "true")
    page.locator("#main-nav a[href='#questions']").click()
    check("mobile menu closes after navigation", page.locator("#main-nav").is_hidden())
    page.locator("#questions details").first.locator("summary").click()
    check("FAQ opens by click", page.locator("#questions details").first.get_attribute("open") is not None)
    page.close()

    page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    page.goto(BASE + "?preview=delay", wait_until="networkidle")
    page.evaluate("""() => { window.__fetchCount=0; const original=window.fetch;
      window.fetch=(...args)=>{window.__fetchCount++;return original(...args)}; }""")
    fill_valid(page)
    page.evaluate("""() => { const f=document.querySelector('#enquiry-form');
      f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
      f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); }""")
    check("duplicate dispatch sends one request", page.evaluate("window.__fetchCount") == 1)
    check("pending disables editing", not page.locator("#name").is_enabled())
    page.locator("#form-result").get_by_text("We could not confirm", exact=False).wait_for(timeout=5000)
    check("timeout is recoverable", page.locator("#name").is_enabled() and page.locator("#success-panel").is_hidden())
    page.close()

    page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    page.goto(BASE, wait_until="networkidle")
    page.evaluate("document.querySelector('#enquiry-form').dataset.formMode='live'")
    check("live switch hides preview notice", page.locator(".form-preview-note").is_hidden())
    fill_valid(page)
    page.locator("#enquiry-form [type=submit]").click()
    page.locator("#success-panel").wait_for(state="visible")
    check("live switch waits for receiver and shows receipt copy", "Thank you for your enquiry." in page.locator("#success-panel").inner_text())
    page.close()
    browser.close()

report = {"status": "pass" if all(item["pass"] for item in checks) else "fail", "url": BASE, "checks": checks, "synthetic_only": True}
(ROOT / "build" / "conversion-review.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"status": report["status"], "checks": len(checks)}, indent=2))
