const { createRequire } = require('module');
const { chromium } = createRequire('/opt/npm-tools/node_modules/')('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 820 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/kioku/dist/kioku.html'); await p.waitForSelector('text=What to study');
  await p.click('nav >> text=Settings'); await p.selectOption('label:has-text("New cards per day") select', '100'); await p.click('nav >> text=Study');
  const row = (r) => `.role-row:has(> span:text-is("${r}"))`; const set = (r, v) => p.click(`${row(r)} button:text-is("${v}")`);
  await set('Faces', 'Secondary'); await set('Silhouettes', 'Primary'); await set('Prefecture', 'Primary'); await set('English', 'Off'); await set('Kanji', 'Off');
  await p.click(`${row('Map')} button:text-is("Off")`); await p.click('text=Practice anyway');
  let seen = 0;
  for (let i = 0; i < 60 && seen < 3; i++) {
    await p.waitForSelector('.cue-box');
    const label = (await p.innerText('.cue-label')).trim();
    if (await p.$('.cue-box .linkview')) { seen++; console.log(label, 'img', await p.$$eval('.cue-box .linkview img', a => a.length), 'kanji', await p.$$eval('.cue-box .linkview .kanji', a => a.length), 'name', await p.$$eval('.cue-box .linkview .text', a => a.length)); }
    if (await p.$('button.choice:not([disabled])')) { await p.click('button.choice >> nth=0'); await p.click('.primary.big'); } else { await p.click('text=Show answer'); await p.click('.grade.g2 >> nth=0'); }
  }
  console.log('link cues seen', seen, errs); await b.close();
})();
