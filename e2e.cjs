const { createRequire } = require('module');
const req = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = req('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, locale: 'en-US' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => m.type() === 'error' && errs.push('CONSOLE ' + m.text()));
  await p.goto('file:///home/claude/kioku/dist/kioku.html');
  await p.waitForSelector('text=Study');
  await p.screenshot({ path: '/tmp/s1_home.png' });
  await p.click('text=Start studying');
  await p.waitForSelector('text=Show answer');
  await p.screenshot({ path: '/tmp/s2_card.png' });
  await p.click('text=Show answer');
  await p.waitForSelector('.grades');
  await p.screenshot({ path: '/tmp/s3_answer.png' });
  // grade 12 cards to exercise the loop
  for (let i = 0; i < 12; i++) {
    await p.click('.grade.g2');
    const more = await p.$('text=Show answer');
    if (!more) break;
    await p.click('text=Show answer'); await p.waitForSelector('.grades');
  }
  await p.screenshot({ path: '/tmp/s4_after.png' });
  // browse + detail + add fact
  await p.click('nav >> text=Cards');
  await p.fill('input[type=search]', 'ichiro');
  await p.click('.list li');
  await p.fill('.row input', 'Test fact from e2e');
  await p.click('text=Add');
  await p.waitForSelector('text=Test fact from e2e');
  await p.screenshot({ path: '/tmp/s5_detail.png', fullPage: false });
  // reload -> persistence
  await p.reload(); await p.waitForSelector('text=Study');
  await p.click('nav >> text=Cards'); await p.fill('input[type=search]', 'e2e');
  const persisted = await p.$$eval('.list li', l => l.length);
  console.log('fact persisted across reload (search hits):', persisted);
  await p.click('nav >> text=Study');
  const stats = await p.$$eval('.stats div', d => d.map(x => x.innerText.replace(/\n/g, ' ')));
  console.log('stats after reload:', stats.join(' | '));
  await p.click('nav >> text=Settings'); await p.screenshot({ path: '/tmp/s6_settings.png' });
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
