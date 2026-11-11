const { createRequire } = require('module');
const { chromium } = createRequire('/opt/npm-tools/node_modules/')('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 820 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/kioku/dist/kioku.html'); await p.waitForSelector('text=What to study');
  const states = () => p.evaluate(() => new Promise(res => { const r = indexedDB.open('kioku'); r.onsuccess = () => { const q = r.result.transaction('states').objectStore('states').getAll(); q.onsuccess = () => res(JSON.stringify(q.result.map(s => [s.id, s.due, s.interval, s.reps]))); }; }));
  const row = (r) => `.role-row:has(> span:text-is("${r}"))`;
  const ok = (c, m) => console.log(c ? 'PASS' : 'FAIL', m);
  ok(!(await p.isDisabled('text=Practice anyway')), 'practice enabled with nothing started');
  await p.click('nav >> text=Settings'); await p.selectOption('label:has-text("New cards per day") select', '100'); await p.click('nav >> text=Study');
  await p.click('text=Start studying');
  for (let i = 0; i < 4; i++) { await p.waitForSelector('button.choice:not([disabled])'); await p.click('button.choice >> nth=0'); await p.click('.primary.big'); }
  await p.click('text=End');
  const before = await states(); const nStart = JSON.parse(before).length;
  ok(!(await p.isDisabled('text=Practice anyway')), 'practice enabled once cards started');
  await p.click('text=Practice anyway');
  await p.waitForSelector('.chip:text-is("Practice")');
  let n = 0;
  for (; n < 200; n++) {
    if (await p.$('button.choice:not([disabled])')) { await p.click('button.choice >> nth=0'); await p.click('.primary.big'); } else break;
  }
  ok(n > 20 && n < 200, 'practice round ran then finished after ' + n + ' cards');
  await p.waitForSelector('text=Practice round finished');
  ok(JSON.stringify(JSON.parse(await states()).map(s => s.slice(1))) === JSON.stringify(JSON.parse(before).map(s => s.slice(1))), 'nothing saved by practice: ' + nStart + ' states before and after');
  console.log('errors', errs); await b.close();
})();
