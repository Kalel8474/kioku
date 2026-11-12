const { createRequire } = require('module');
const { chromium } = createRequire('/opt/npm-tools/node_modules/')('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 820 }, deviceScaleFactor: 1.5 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/kioku/dist/kioku.html'); await p.waitForSelector('text=What to study');
  const ok = (c, m) => console.log(c ? 'PASS' : 'FAIL', m);
  const n = (s) => p.$$(s).then(a => a.length);
  await p.click('nav >> text=Look up');
  await p.waitForSelector('.zoom .pm');
  const l0 = await n('.zoom .pm-label'); ok(l0 > 0 && l0 < 30, 'full map shows only the names that fit: ' + l0);
  await p.screenshot({ path: '/tmp/lk_map.png' });
  const box = await p.locator('.zoom').boundingBox();
  await p.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55);
  for (let i = 0; i < 8; i++) await p.mouse.wheel(0, -300);
  await p.waitForTimeout(100);
  const l1 = await n('.zoom .pm-label'); ok(l1 > 0, 'zoomed in shows labels: ' + l1);
  await p.screenshot({ path: '/tmp/lk_zoom.png' });
  await p.click('.zoomctl button[aria-label=Reset]'); 
  // tap-through: click Hokkaido (big) on the map
  await p.dispatchEvent('.zoom .pm-p[data-id=pref-hokkaido]', 'click'); await p.waitForSelector('h1:text-is("Hokkaido")'); ok(true, 'tap on map opens Hokkaido');
  await p.click('text=‹ Back');
  // search
  await p.fill('.search', 'osa'); ok(await n('.hit') >= 1, 'search "osa" gives hits');
  await p.click('.hit >> text=Osaka'); await p.waitForSelector('h1:text-is("Osaka")');
  ok(await n('.answer-box .pm-p.mark') === 1, 'detail: Osaka highlighted on area map');
  ok(await n('.answer-box .pm-label') >= 3, 'detail: area names shown: ' + await n('.answer-box .pm-label'));
  await p.screenshot({ path: '/tmp/lk_detail.png', fullPage: true });
  const ppl = await n('.person'); console.log('celebrities listed:', ppl);
  if (ppl) { await p.click('.person >> nth=0'); await p.waitForSelector('.recap-row.ref'); await p.screenshot({ path: '/tmp/lk_person.png' }); await p.click('.recap-row.ref button.plain'); await p.waitForSelector('h1:text-is("Osaka")'); ok(true, 'person -> prefecture link works'); }
  await p.click('text=‹ Back'); if (ppl) await p.click('text=‹ Back');
  await p.fill('.search', '大阪'); ok(await n('.hit') >= 1, 'kanji search works');
  await p.fill('.search', 'zzzz'); ok(await p.isVisible('text=No matches'), 'no matches message');
  console.log('errors', errs); await b.close();
})();
