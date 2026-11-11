const { createRequire } = require('module');
const { chromium } = createRequire('/opt/npm-tools/node_modules/')('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 820 }, deviceScaleFactor: 1.5 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/kioku/dist/kioku.html'); await p.waitForSelector('text=What to study');
  await p.click('nav >> text=Settings'); await p.selectOption('label:has-text("New cards per day") select', '100'); await p.click('nav >> text=Study');
  const row = (r) => `.role-row:has(> span:text-is("${r}"))`;
  const setRole = async (r, v) => p.click(`${row(r)} button:text-is("${v}")`);
  const n = (sel) => p.$$(sel).then(a => a.length);
  const ok = (c, m) => console.log(c ? 'PASS' : 'FAIL', m);
  // A: English -> Silhouettes, Map All, 2 choices
  await setRole('Faces', 'Off'); await setRole('Silhouettes', 'Secondary'); await setRole('English', 'Primary');
  await p.click(`${row('Map')} button:text-is("All")`); await p.click(`${row('Choices')} button:text-is("2")`);
  await p.click('text=Start studying');
  // may start with a person card (English->Silhouettes has no tap if person cards); loop until a map question appears
  let found = false;
  for (let i = 0; i < 15 && !found; i++) {
    await p.waitForSelector('.screen.study');
    if (await n('.answer-box .pm')) { found = true; break; }
    // advance whatever this is
    if (await n('button.choice:not([disabled])')) { await p.click('button.choice >> nth=0'); await p.click('.primary.big'); }
    else if (await n('text=Show answer')) { await p.click('text=Show answer'); await p.click('.grade.g2 >> nth=0'); }
    else break;
  }
  ok(found, 'A: tap-map question appears (All, 2 choices)');
  ok(await n('.answer-box .pm-p.cand') === 2, 'A: exactly 2 tappable candidates');
  ok(await n('.answer-box .pm-halo') === 2, 'A: halos on small targets');
  await p.screenshot({ path: '/tmp/map_all_2.png' });
  const right = await p.evaluate(() => 0);
  // tap the wrong one first (the candidate not named in the cue): try first cand, see result
  await p.click('.answer-box .pm-halo >> nth=0');
  const note = await p.innerText('.notice'); ok(/✓|✗/.test(note), 'A: graded: ' + note.replace(/\n/g, ' '));
  await p.screenshot({ path: '/tmp/map_all_2_done.png' });
  await p.click('.primary.big');
  await p.click('text=End');
  // B: Silhouettes -> English, Map Area, 4 choices: cue map has 1 red prefecture
  await setRole('Silhouettes', 'Primary'); await setRole('English', 'Secondary');
  await p.click(`${row('Map')} button:text-is("Area")`); await p.click(`${row('Choices')} button:text-is("4")`);
  await p.click('text=Start studying');
  for (let i = 0; i < 10 && !(await n('.cue-box .pm')); i++) { if (await n('button.choice:not([disabled])')) { await p.click('button.choice >> nth=0'); await p.click('.primary.big'); } else break; }
  ok(await n('.cue-box .pm') === 1, 'B: cue shows a map');
  ok(await n('.cue-box .pm-p.mark') === 1, 'B: exactly one red prefecture');
  ok(await n('.cue-box .pm-p.in') >= 3, 'B: area neighbours drawn green');
  ok(await n('button.choice') === 4, 'B: 4 English choices: ' + await n('button.choice'));
  await p.screenshot({ path: '/tmp/map_cue_area.png' });
  await p.click('text=End');
  // C: Map Off -> bare silhouette
  await p.click(`${row('Map')} button:text-is("Off")`); await p.click('text=Start studying');
  await p.waitForSelector('.cue-box');
  ok(await n('.cue-box .pm') === 0, 'C: Off -> no map');
  await p.click('text=End');
  // D: choices Off, Area map, English -> Silhouettes: every prefecture of region tappable
  await setRole('Silhouettes', 'Secondary'); await setRole('English', 'Primary');
  await p.click(`${row('Map')} button:text-is("Area")`); await p.click(`${row('Choices')} button:text-is("Off")`);
  await p.click('text=Start studying');
  found = false;
  for (let i = 0; i < 15 && !found; i++) {
    if (await n('.answer-box .pm')) { found = true; break; }
    if (await n('text=Show answer')) { await p.click('text=Show answer'); await p.click('.grade.g2 >> nth=0'); } else break;
  }
  const cands = await n('.answer-box .pm-p.cand');
  ok(found && cands >= 4 && cands <= 9, 'D: all area prefectures tappable: ' + cands);
  await p.screenshot({ path: '/tmp/map_area_off.png' });
  await p.dispatchEvent('.answer-box .pm-p.cand >> nth=0', 'click'); ok(await n('.notice') > 0, 'D: graded');
  await p.click('text=End');
  // E: Faces -> Prefecture link: tap where she is from
  await setRole('Silhouettes', 'Off'); await setRole('English', 'Off'); await setRole('Faces', 'Primary'); await setRole('Prefecture', 'Secondary');
  await p.click(`${row('Choices')} button:text-is("4")`); await p.click('text=Start studying');
  await p.waitForSelector('.answer-box .pm', { timeout: 5000 }).catch(() => {});
  ok(await n('.answer-box .pm-p.cand') === 4, 'E: faces -> tap prefecture, 4 candidates');
  await p.screenshot({ path: '/tmp/map_faces.png' });
  console.log('page errors:', errs);
  await b.close();
})();
