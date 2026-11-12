const { createRequire } = require('module');
const { chromium } = createRequire('/opt/npm-tools/node_modules/')('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 820 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/kioku/dist/kioku.html'); await p.waitForSelector('text=What to study');
  const row = (r) => `.role-row:has(> span:text-is("${r}"))`; const set = (r, v) => p.click(`${row(r)} button:text-is("${v}")`);
  await set('Faces', 'Secondary'); await set('Silhouettes', 'Primary'); await set('English', 'Secondary'); await set('Kanji', 'Off'); await set('Prefecture', 'Primary');
  await p.click(`${row('Choices')} button:text-is("Off")`);
  for (const map of ['Area', 'Off']) {
    await p.click(`${row('Map')} button:text-is("${map}")`); await p.click('text=Practice anyway');
    const seen = new Set();
    for (let i = 0; i < 40; i++) {
      await p.waitForSelector('.cue-box');
      const lab = (await p.innerText('.cue-label')).trim();
      const info = { map: await p.$$eval('.cue-box .pm', a => a.length), mark: await p.$$eval('.cue-box .pm-p.mark', a => a.length), img: await p.$$eval('.cue-box img', a => a.length), text: (await p.innerText('.cue-box')).trim() };
      seen.add(lab + ' ' + JSON.stringify(info));
      await p.click('text=Show answer');
      for (let k = 0; k < 4; k++) { const g = p.locator('.grade.g2:not([disabled])'); if (await g.count()) await g.first().click().catch(() => {}); else break; }
    }
    console.log('Map', map, [...seen].slice(0, 6));
    await p.click('text=End');
  }
  console.log('errors', errs); await b.close();
})();
