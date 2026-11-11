const { createRequire } = require('module');
const { chromium } = createRequire('/opt/npm-tools/node_modules/')('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 820 }, deviceScaleFactor: 1.5 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/kioku/dist/kioku.html'); await p.waitForSelector('text=What to study');
  await p.screenshot({ path: '/tmp/e1_home.png' });
  const row = (r) => `.role-row:has(> span:text-is("${r}"))`;
  const set = async (r, v) => p.click(`${row(r)} button:text-is("${v}")`);
  // default plan: Faces/Silhouettes -> English. 12 cards: cue label must be Faces or Silhouettes; prompt English
  await p.click('text=Start studying');
  const seen = [];
  for (let i = 0; i < 12; i++) {
    await p.waitForSelector('text=Show answer');
    seen.push((await p.innerText('.cue-label')) + '>' + (await p.innerText('.prompt')).replace('→ Recall: ', ''));
    await p.click('text=Show answer'); await p.click('.grade.g2');
  }
  console.log('default plan, first 12:', [...new Set(seen)].join(' | '));
  // order sanity: random mode gives different first card across reloads? check order toggle exists
  await p.click('text=End');
  // Example 3: Silhouettes primary; English + Faces secondary; Faces no longer primary
  await set('Faces', 'Secondary'); await set('English', 'Secondary'); await set('Silhouettes', 'Primary');
  await p.click('text=Card order');
  await p.screenshot({ path: '/tmp/e2_picker.png' });
  await p.click('text=Start studying');
  let multi = null;
  for (let i = 0; i < 30; i++) {
    await p.waitForSelector('text=Show answer');
    const prompt = await p.innerText('.prompt'); const cue = (await p.innerText('.cue-label')).toLowerCase() === 'silhouettes' ? 'Silhouettes' : 'x';
    if (cue === 'Silhouettes' && prompt.includes('Faces')) { multi = { cue, prompt }; break; }
    await p.click('text=Show answer'); await p.click('.grade.g2:not([disabled]) >> nth=0');
  }
  console.log('multi-answer test:', JSON.stringify(multi));
  await p.click('text=Show answer'); await p.waitForSelector('.ans-block');
  const blocks = await p.$$eval('.ans-block .cue-label', e => e.map(x => x.innerText));
  await p.screenshot({ path: '/tmp/e3_multi.png' });
  // grade only first answer: must NOT advance
  await p.click('.ans-block >> nth=0 >> .grade.g2');
  const stillHere = await p.isVisible('.ans-block'); 
  // grade the rest
  const total = blocks.length; for (let k = 1; k < total; k++) await p.click(`.ans-block >> nth=${k} >> .grade.g2`);
  await p.waitForTimeout(150);
  console.log('answers:', blocks.join(','), '| stayed after 1st grade:', stillHere, '| advanced after all:', !(await p.$$('.ans-block')).length || (await p.innerText('.cue-label')) !== 'x');
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})().catch(e => { console.error('FAIL', e.message.split('\n')[0]); process.exit(1); });
