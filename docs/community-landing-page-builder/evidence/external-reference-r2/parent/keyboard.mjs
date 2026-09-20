import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from '/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const results = [];
try {
  for (const viewport of [{width:390,height:844},{width:1280,height:600},{width:320,height:568}]) {
    const page = await browser.newPage({ viewport });
    await page.goto('http://127.0.0.1:4199/', { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert.equal(overflow, false);
    await page.locator('#name').focus();
    const fields = [];
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(1300);
      const item = await page.evaluate(() => {
        const e = document.activeElement, r = e.getBoundingClientRect();
        const fragments = [...e.getClientRects()].filter(b=>b.width>0&&b.height>0);
        const visible = fragments.length > 0 && fragments.every(b=>{
          const top=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
          return b.top>=0&&b.bottom<=innerHeight&&b.left>=0&&b.right<=innerWidth&&(top===e||e.contains(top));
        });
        const center = document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
        const usableTextarea = e.tagName === 'TEXTAREA' && r.top >= 0 && r.y+r.height/2 < innerHeight && center === e;
        return {id:e.id || e.textContent.trim().slice(0,45), bounds:r.toJSON(), fullyVisible:visible, visible:visible || usableTextarea, submit:e.type==='submit'};
      });
      fields.push(item);
      if(!item.visible) await page.screenshot({path:new URL(`${viewport.width}-focus-failure.png`,import.meta.url).pathname});
      assert.ok(item.visible, JSON.stringify({viewport,item}));
      if (item.submit) break;
      await page.keyboard.press('Tab');
    }
    assert.ok(fields.at(-1).submit, 'Keyboard reaches submit');
    results.push({viewport,overflow,fields});
    if(viewport.width===320) { await page.evaluate(()=>scrollTo(0,0)); await page.screenshot({path:new URL('320x568-first.png',import.meta.url).pathname}); }
    await page.close();
  }
  await writeFile(new URL('keyboard.json',import.meta.url), JSON.stringify({status:'pass',results},null,2)+'\n');
  console.log(JSON.stringify({status:'pass',viewports:results.length,fields:results.map(r=>r.fields.length)}));
} finally { await browser.close(); }
