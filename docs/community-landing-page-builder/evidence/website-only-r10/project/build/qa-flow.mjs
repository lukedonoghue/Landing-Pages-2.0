import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const baseUrl = "http://127.0.0.1:4187/";
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const projectRoot = join(process.cwd(), "project");
const screenshotRoot = join(projectRoot, "build", "screenshots");
const reportPath = join(projectRoot, "build", "form-flow-review.json");
const checks = [];

function check(name, condition, detail) {
  checks.push({ name, status: condition ? "pass" : "fail", detail });
  if (!condition) throw new Error(`${name}: ${detail}`);
}

async function openForm(page, url = baseUrl) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator(".hero [data-open-modal]").click();
  await page.locator("#quote-dialog").waitFor({ state: "visible" });
}

async function fillValidForm(page) {
  await page.selectOption("#service", "Window cleaning");
  await page.locator('input[name="frequency"]').first().check();
  await page.fill("#name", "Local QA Test");
  await page.fill("#email", "qa@example.com");
  await page.fill("#phone", "0117 000 0000");
  await page.fill("#address", "1 Test Street, Bristol");
  await page.fill("#postcode", "BS1 1AA");
  await page.fill("#message", "Local preview acceptance check");
}

const browser = await chromium.launch({ executablePath: chromePath, headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  context.setDefaultTimeout(8000);

  const validationPage = await context.newPage();
  console.error("QA stage: validation");
  await openForm(validationPage);
  await validationPage.locator('#quote-form button[type="submit"]').click();
  await validationPage.locator("#form-errors").waitFor({ state: "visible" });
  const initialErrors = await validationPage.locator("#form-errors li").count();
  const summaryFocused = await validationPage.evaluate(() => document.activeElement?.id === "form-errors");
  check("Empty submission identifies every required group", initialErrors === 7, `Found ${initialErrors} errors; expected 7.`);
  check("Error summary receives focus", summaryFocused, `Focused: ${summaryFocused}.`);

  await validationPage.selectOption("#service", "Window cleaning");
  const correctedErrors = await validationPage.locator("#form-errors li").count();
  const serviceErrorHidden = await validationPage.locator("#service-error").evaluate((element) => element.hidden);
  check("Corrected fields clear live", correctedErrors === 6 && serviceErrorHidden, `Found ${correctedErrors} remaining errors.`);
  await validationPage.screenshot({ path: join(screenshotRoot, "390x844-validation.png") });

  await validationPage.locator("[data-close-modal]").first().click();
  const focusRestored = await validationPage.evaluate(() => document.activeElement?.hasAttribute("data-open-modal"));
  check("Closing restores focus to the opener", focusRestored, `Focus restored: ${focusRestored}.`);

  const failurePage = await context.newPage();
  console.error("QA stage: failure");
  await openForm(failurePage, `${baseUrl}?qa=failure`);
  await fillValidForm(failurePage);
  await failurePage.locator('#quote-form button[type="submit"]').click();
  await failurePage.locator("#submit-error").waitFor({ state: "visible" });
  const failureState = await failurePage.evaluate(() => ({
    focused: document.activeElement?.id === "submit-error",
    name: document.querySelector("#name")?.value,
    dialogOpen: document.querySelector("#quote-dialog")?.open === true
  }));
  check("Failure state is focused and keeps the form open", failureState.focused && failureState.dialogOpen, JSON.stringify(failureState));
  check("Failure preserves entered values", failureState.name === "Local QA Test", `Preserved name was ${failureState.name}.`);
  await failurePage.screenshot({ path: join(screenshotRoot, "390x844-failure.png") });

  const successPage = await context.newPage();
  console.error("QA stage: success");
  await openForm(successPage);
  await fillValidForm(successPage);
  await successPage.locator('#quote-form button[type="submit"]').click();
  await successPage.locator("#quote-success").waitFor({ state: "visible" });
  await successPage.waitForTimeout(100);
  const successState = await successPage.evaluate(() => ({
    focused: document.activeElement?.id === "quote-success",
    message: document.querySelector("#quote-success h3")?.textContent?.trim(),
    panelRect: document.querySelector("#quote-success")?.getBoundingClientRect().toJSON(),
    headerRect: document.querySelector(".dialog-header")?.getBoundingClientRect().toJSON(),
    panelDisplay: getComputedStyle(document.querySelector("#quote-success")).display,
    formHidden: document.querySelector("#quote-form")?.hidden,
    dialogScrollTop: document.querySelector("#quote-dialog")?.scrollTop,
    shellScrollTop: document.querySelector(".dialog-shell")?.scrollTop
  }));
  check("Local success state is explicit and focused", successState.focused && successState.message === "Preview complete. Nothing was sent.", JSON.stringify(successState));
  await successPage.screenshot({ path: join(screenshotRoot, "390x844-success.png") });

  const productionPage = await context.newPage();
  console.error("QA stage: production response");
  await openForm(productionPage, `${baseUrl}?qa=production`);
  await fillValidForm(productionPage);
  await productionPage.locator('#quote-form button[type="submit"]').click();
  await productionPage.locator("#quote-success").waitFor({ state: "visible" });
  const productionState = await productionPage.evaluate(() => ({
    label: document.querySelector("#quote-success .success-label")?.textContent?.trim(),
    message: document.querySelector("#quote-success h3")?.textContent?.trim()
  }));
  check(
    "Production endpoint response selects the sent confirmation",
    productionState.label === "Request received" && productionState.message === "Thanks. Your quote request has been sent.",
    JSON.stringify(productionState)
  );
  await productionPage.screenshot({ path: join(screenshotRoot, "390x844-production-success.png") });

  await fetch(`${baseUrl}__qa__/reset`, { method: "POST" });
  const duplicatePage = await context.newPage();
  console.error("QA stage: duplicate guard");
  await openForm(duplicatePage, `${baseUrl}?qa=hold`);
  await fillValidForm(duplicatePage);
  await duplicatePage.evaluate(() => {
    const form = document.querySelector("#quote-form");
    form.requestSubmit();
    form.requestSubmit();
  });
  await duplicatePage.locator("#quote-success").waitFor({ state: "visible" });
  const stats = await fetch(`${baseUrl}__qa__/stats`).then((response) => response.json());
  check("Rapid duplicate submit sends one request", stats.quoteRequests === 1, `Observed ${stats.quoteRequests} requests.`);

  await context.close();
} catch (error) {
  checks.push({ name: "Acceptance script completed", status: "fail", detail: error.message });
} finally {
  await browser.close();
}

const report = {
  schema_version: 1,
  status: checks.every((item) => item.status === "pass") ? "pass" : "fail",
  url: baseUrl,
  viewport: "390x844",
  checks
};

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.status === "pass" ? 0 : 1;
