const { createRequire } = require('module');
const { chromium } = createRequire('/opt/npm-tools/node_modules/')('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 820 }, deviceScaleFactor: 1.5 }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/kioku/dist/kioku.html'); await p.waitForSelector('text=What to study');
  const ok = (c, m) => console.log(c ? 'PASS' : 'FAIL', m);
  const n = (s) => p.$$(s).then(a => a.length);
  // --- add photos to Suzu Hirose
  await p.click('nav >> text=Cards'); await p.fill('input[type=search]', 'Hirose'); await p.click('li:has-text("Suzu Hirose")');
  await p.waitForSelector('.photos');
  ok((await p.innerText('.photos')).includes('1 photo'), 'starts with 1 photo');
  const pics = fs.readdirSync('/mnt/user-data/uploads').filter(f => f.endsWith('.jpg')).slice(0, 2).map(f => '/mnt/user-data/uploads/' + f);
  await p.setInputFiles('.addphoto input', pics[0]); await p.waitForSelector('.photo-row img');
  await p.setInputFiles('.addphoto input', pics[1]); await p.waitForFunction(() => document.querySelectorAll('.photo-row img').length === 2);
  ok((await p.innerText('.photos')).includes('3 photos'), 'now 3 photos');
  // make main
  const mainBefore = await p.getAttribute('.detail-row img.img', 'src');
  await p.click('.photo-cell >> nth=0 >> text=Make main');
  const mainAfter = await p.getAttribute('.detail-row img.img', 'src');
  ok(mainBefore !== mainAfter && (await n('.photo-row img')) === 2, 'make main swaps the main photo');
  // look up shows extras
  await p.click('nav >> text=Look up'); await p.fill('.search', 'hirose'); await p.click('.hit >> nth=0');
  await p.waitForSelector('.recap-row.ref'); ok(await n('.photo-row .thumb') === 2, 'look up shows 2 extra photos');
  // study rotation: Silhouettes primary, Faces secondary, choices Off -> answers show a photo; sample many cards
  await p.click('nav >> text=Study');
  const row = (r) => `.role-row:has(> span:text-is("${r}"))`; const set = (r, v) => p.click(`${row(r)} button:text-is("${v}")`);
  await set('Faces', 'Primary'); await set('Silhouettes', 'Off'); await set('English', 'Secondary'); await set('Prefecture', 'Off');
  await p.click(`${row('Choices')} button:text-is("Off")`); await p.click('text=Practice anyway');
  const srcs = new Set(); let cuePhotos = 0;
  for (let i = 0; i < 30; i++) {
    await p.waitForSelector('.cue-box img'); const s = await p.getAttribute('.cue-box img', 'src'); srcs.add(s.length);
    await p.click('text=Show answer'); const g = p.locator('.grade.g2:not([disabled])'); await g.first().click();
  }
  console.log('distinct photo sizes seen in cues (>=1):', srcs.size);
  await p.click('text=End').catch(() => {});
  // --- print
  await p.click('nav >> text=Cards'); await p.click('text=🖨️ Print');
  await p.click('text=Select all shown'); ok(await n('ul.list li.on') === 30, '30 persons selected');
  ok((await p.innerText('.muted >> text=selected')).includes('3 sheets'), 'sheets = 3');
  await p.waitForSelector('.pv .sheet');
  await p.screenshot({ path: '/tmp/print_ui.png', fullPage: true });
  // render print pages to pdf
  await p.evaluate(() => { window.print = () => {}; });
  await p.click('text=Print 30 cards'); await p.waitForSelector('.print-root', { state: 'attached' });
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: '/tmp/cards.pdf', preferCSSPageSize: true, printBackground: true });
  console.log('errors', errs); await b.close();
})();
