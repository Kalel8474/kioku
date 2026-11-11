const { createRequire } = require('module');
const { chromium } = createRequire('/opt/npm-tools/node_modules/')('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 820 }, deviceScaleFactor: 1.5 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/kioku/dist/kioku.html'); await p.waitForSelector('text=What to study');
  await p.click('nav >> text=Settings'); await p.selectOption('label:has-text("New cards per day") select', '100'); await p.click('nav >> text=Study');
  const row = (r) => `.role-row:has(> span:text-is("${r}"))`;
  const lastState = () => p.evaluate(() => new Promise(res => { const r = indexedDB.open('kioku'); r.onsuccess = () => { const q = r.result.transaction('states').objectStore('states').getAll(); q.onsuccess = () => { const all = q.result.filter(s => s.last > 0).sort((a, b) => b.last - a.last); res(all[0] ? { ...all[0], deltaMin: Math.round((all[0].due - all[0].last) / 60000) } : null); }; }; }));
  // default: 2 choices, Faces/Silhouettes -> English
  await p.click('text=Start studying'); await p.waitForSelector('button.choice');
  console.log('default choice buttons:', (await p.$$('button.choice')).length);
  const tally = { right: {}, wrong: {} };
  for (let i = 0; i < 24; i++) {
    await p.waitForSelector('button.choice:not([disabled])');
    await p.click('button.choice >> nth=0');
    const ok = (await p.innerText('.notice')).includes('Correct');
    const st = await lastState();
    const key = ok ? 'right' : 'wrong'; tally[key][st.deltaMin] = (tally[key][st.deltaMin] || 0) + 1;
    await p.click('.primary.big');   // Continue
  }
  console.log('2-choice: delta minutes by outcome', JSON.stringify(tally));
  await p.screenshot({ path: '/tmp/mc2.png' });
  await p.click('text=End');
  // 4 choices
  await p.click(`${row('Choices')} button:text-is("4")`); await p.click('text=Start studying'); await p.waitForSelector('button.choice');
  console.log('4-choice buttons:', (await p.$$('button.choice')).length);
  const t4 = { right: {}, wrong: {} };
  for (let i = 0; i < 20; i++) { await p.click('button.choice >> nth=1'); const ok = (await p.innerText('.notice')).includes('Correct'); const st = await lastState(); const k = ok ? 'right' : 'wrong'; t4[k][st.deltaMin] = (t4[k][st.deltaMin] || 0) + 1; await p.click('.primary.big'); await p.waitForSelector('button.choice:not([disabled])'); }
  console.log('4-choice: delta minutes', JSON.stringify(t4));
  await p.screenshot({ path: '/tmp/mc4.png' });
  await p.click('text=End');
  // multi-answer with choices: Silhouettes -> English + Faces
  await p.click(`${row('Faces')} button:text-is("Secondary")`); await p.click(`${row('Silhouettes')} button:text-is("Primary")`);
  await p.click(`${row('Choices')} button:text-is("2")`); await p.click('text=Card order'); await p.click('text=Start studying');
  let seq = null;
  for (let i = 0; i < 40 && !seq; i++) {
    await p.waitForSelector('button.choice:not([disabled])'); const pr = await p.innerText('.prompt');
    if (pr.includes('1 of')) { seq = [pr]; break; }
    await p.click('button.choice >> nth=0'); await p.click('.primary.big');
  }
  console.log('sequence:', JSON.stringify(seq));
  for (let k = 0; k < 3; k++) { await p.waitForSelector('button.choice:not([disabled])'); seq.push((await p.innerText('.prompt')).replace(/\n/g, ' ')); await p.click('button.choice >> nth=0'); await p.screenshot({ path: `/tmp/mcseq${k}.png` }); const btn = await p.innerText('.primary.big'); seq.push(btn); await p.click('.primary.big'); if (btn === 'Continue') break; }
  console.log('walk:', JSON.stringify(seq.slice(1)));
  await p.click('text=End');
  // Off -> classic reveal flow
  await p.click(`${row('Choices')} button:text-is("Off")`); await p.click('text=Start studying');
  console.log('off mode shows Show answer:', await p.isVisible('text=Show answer'), '| choice buttons:', (await p.$$('button.choice')).length);
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})().catch(e => { console.error('FAIL', e.message.split('\n')[0]); process.exit(1); });
