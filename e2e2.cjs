const { createRequire } = require('module');
const { chromium } = createRequire('/opt/npm-tools/node_modules/')('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/kioku/dist/kioku.html'); await p.waitForSelector('text=Study');
  // 1) add a person via the form, with an uploaded photo and a prefecture link
  await p.click('nav >> text=Cards'); await p.click('text=＋ Add');
  await p.selectOption('select >> nth=0', 't-person');
  const labels = await p.$$eval('label', l => l.map(x => x.innerText.split('\n')[0]));
  console.log('person form fields:', labels.join(', '));
  await p.setInputFiles('input[type=file]', '/mnt/user-data/uploads/4cda9f5b-image.jpg');
  await p.fill('label:has-text("Name") input', 'Test Person');
  await p.fill('label:has-text("Kanji") input', '試験 太郎');
  await p.selectOption('select >> nth=1', 'pref-tokyo');
  await p.fill('label:has-text("First fact") input', 'Made for e2e');
  await p.click('text=Save'); await p.waitForSelector('h1:has-text("Test Person")');
  console.log('saved person; detail shows link:', await p.isVisible('text=東京都'));
  // 2) custom template: Guitar chord
  await p.click('nav >> text=Settings'); await p.click('text=＋ New card type');
  await p.fill('input[placeholder^="e.g. Guitar"]', 'Guitar chord');
  await p.fill('.facet-edit input >> nth=0', 'Chord name');
  await p.click('text=＋ Add piece'); await p.fill('.facet-edit >> nth=1 >> input[placeholder^="Label"]', 'Shape');
  await p.selectOption('.facet-edit >> nth=1 >> select', 'text');
  await p.click('text=Save');
  await p.click('nav >> text=Cards'); await p.click('text=＋ Add');
  await p.selectOption('select >> nth=0', { label: 'Guitar chord' });
  await p.fill('label:has-text("Chord name") input', 'Am7'); await p.fill('label:has-text("Shape") input', 'x02010');
  await p.click('text=Save'); await p.waitForSelector('h1:has-text("Am7")');
  // 3) study only the chord type: should present Am7 cards both directions
  await p.click('nav >> text=Study'); await p.click('.chip.btn:has-text("Guitar chord")'); await p.click('text=Start studying');
  const seen = new Set();
  for (let i = 0; i < 10; i++) {
    if (!(await p.$('text=Show answer'))) break;
    seen.add(((await p.innerText('.cue-label')) + ' -> ' + (await p.innerText('.prompt'))).replace(/\n/g, ' '));
    await p.click('text=Show answer'); await p.click('.grade.g0');
  }
  console.log('chord directions seen:', [...seen].join(' || '));
  // 4) backup roundtrip
  await p.click('nav >> text=Settings');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('text=Download backup')]);
  const path = await dl.path(); const fs = require('fs'); const j = JSON.parse(fs.readFileSync(path, 'utf8'));
  console.log('backup items/states/templates:', j.items.length, j.states.length, j.templates.length);
  await p.setInputFiles('label:has-text("Restore") input', path); await p.waitForSelector('text=Backup restored');
  console.log('restore ok; errors:', errs.length ? errs : 'none');
  await p.click('nav >> text=Study'); await p.screenshot({ path: '/tmp/s7.png' });
  await b.close();
})().catch(e => { console.error('FAIL', e.message.split('\n')[0]); process.exit(1); });
