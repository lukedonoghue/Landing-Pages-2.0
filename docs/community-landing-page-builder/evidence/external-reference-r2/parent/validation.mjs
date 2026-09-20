import { chromium } from '/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const checks=[];
try {
  for(const fromCTA of [false,true]) {
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    await page.route('**/api/enquiry',route=>route.abort());
    await page.goto('http://127.0.0.1:4199/',{waitUntil:'networkidle'});
    if(fromCTA) {await page.locator('.hero [data-primary-action]').click();await page.waitForTimeout(1800);}
    await page.locator('.submit-button').click();
    await page.waitForTimeout(2500);
    checks.push(await page.evaluate(fromCTA=>({fromCTA,focus:document.activeElement.id,name:document.querySelector('#name').getBoundingClientRect().toJSON(),label:document.querySelector('label[for=name]').getBoundingClientRect().toJSON(),summary:document.querySelector('#error-summary').getBoundingClientRect().toJSON()}),fromCTA));
    await page.screenshot({path:new URL(`validation-${fromCTA?'cta':'direct'}.png`,import.meta.url).pathname});
    await page.close();
  }
  await writeFile(new URL('validation.json',import.meta.url),JSON.stringify(checks,null,2)+'\n');
  console.log(JSON.stringify(checks,null,2));
} finally {await browser.close();}
