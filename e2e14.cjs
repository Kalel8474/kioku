const { createRequire } = require('module');
const { chromium } = createRequire('/opt/npm-tools/node_modules/')('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 820 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/kioku/dist/kioku.html'); await p.waitForSelector('text=What to study');
  const ok = (c, m) => console.log(c ? 'PASS' : 'FAIL', m);
  const row = (r) => `.role-row:has(> span:text-is("${r}"))`; const set = (r, v) => p.click(`${row(r)} button:text-is("${v}")`);
  await p.click('nav >> text=Settings'); await p.selectOption('label:has-text("New cards per day") select', '100'); await p.click('nav >> text=Study');
  await set('Faces', 'Primary'); await set('Silhouettes', 'Off'); await set('English', 'Secondary'); await set('Kanji', 'Secondary'); await set('Reading', 'Off'); await set('Prefecture', 'Off');
  await set('Names', 'Last'); await p.click(`${row('Choices')} button:text-is("Off")`);
  await p.click('text=Start studying');
  let split = 0;
  for (let i = 0; i < 12 && split < 2; i++) {
    await p.waitForSelector('.cue-box');
    const hint = await p.$('.name-hint'); const h = hint ? (await hint.innerText()).replace(/\n/g, ' ') : '';
    await p.click('text=Show answer'); const ans = (await p.innerText('.answer-box, .answers').catch(() => '')).replace(/\n/g, ' | ');
    if (i < 3) console.log('Last mode ->', h, '||', ans.slice(0, 80));
    if (i === 0) { ok(/Hint/.test(h) && !/^Hint\s*$/.test(h), 'hint shown in question'); await p.screenshot({ path: '/tmp/names_last.png' }); }
    for (let k = 0; k < 4; k++) { const g = p.locator('.grade.g2:not([disabled])'); if (await g.count()) await g.first().click().catch(() => {}); else break; }
    split++;
  }
  await p.click('text=End');
  await set('Names', 'Split');
  await p.click('text=Start studying'); await p.waitForSelector('.cue-box');
  await p.click('text=Show answer');
  console.log('split grade rows:', await p.$$eval('.grades', a => a.length), 'answer labels:', (await p.$$eval('.ans-label, .answer-label, .cue-label', a => a.map(x => x.textContent.trim()))).join(' / '));
  await p.screenshot({ path: '/tmp/names_split.png', fullPage: true });
  await p.click('text=End');
  await set('Names', 'Last'); await p.click(`${row('Choices')} button:text-is("4")`); await p.click('text=Start studying');
  await p.waitForSelector('.choice'); const texts = await p.$$eval('.choice', a => a.map(x => x.innerText.trim())); console.log('choices (Last, 4):', texts);
  ok(texts.length === 4, 'four surname choices');
  console.log('errors', errs); await b.close();
})();
