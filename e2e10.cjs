const { createRequire } = require('module');
const { chromium } = createRequire('/opt/npm-tools/node_modules/')('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 820 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/kioku/dist/kioku.html'); await p.waitForSelector('text=What to study');
  await p.click('nav >> text=Settings'); await p.selectOption('label:has-text("New cards per day") select', '100'); await p.click('nav >> text=Study');
  const row = (r) => `.role-row:has(> span:text-is("${r}"))`; const set = (r, v) => p.click(`${row(r)} button:text-is("${v}")`);
  await set('Faces', 'Off'); await set('Silhouettes', 'Primary'); await set('English', 'Secondary'); await set('Prefecture', 'Off');
  await p.click(`${row('Choices')} button:text-is("Off")`); await p.click(`${row('Map')} button:text-is("Off")`);
  await p.click('text=Start studying');
  let hit = 0;
  for (let i = 0; i < 47 && !hit; i++) {
    await p.click('text=Show answer');
    const d = p.locator('details.recap', { hasText: 'Rest of this card' });
    if (await d.count()) { await d.locator('summary').click(); }
    if (await p.$('.namelist')) { hit = 1; console.log('PASS names listed:', (await p.innerText('.namelist')).replace(/\n/g, ' | '), '| photos in recap:', await p.$$eval('details.recap img', a => a.length)); }
    await p.click('.grade.g2 >> nth=0');
  }
  if (!hit) console.log('FAIL no card with celebrities shown');
  console.log('errors', errs); await b.close();
})();
