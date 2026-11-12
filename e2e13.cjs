const { createRequire } = require('module');
const { chromium } = createRequire('/opt/npm-tools/node_modules/')('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 820 }, deviceScaleFactor: 1.5 }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => console.log(c ? 'PASS' : 'FAIL', m);
  const url = 'file:///home/claude/kioku/dist/kioku.html';
  await p.goto(url); await p.waitForSelector('text=What to study');
  await p.click('nav >> text=Cards');
  ok((await p.innerText('.muted >> text=cards')).includes('of 97 cards'), 'deck has 97 cards: ' + (await p.innerText('.muted >> text=of ')));
  await p.click('nav >> text=Look up'); await p.fill('.search', 'kumamoto'); await p.click('.hit >> nth=0'); await p.waitForSelector('.people');
  const names = await p.$$eval('.person span', a => a.map(x => x.textContent));
  ok(names.length === 4, 'Kumamoto lists 4 celebrities: ' + names.join(', '));
  await p.screenshot({ path: '/tmp/kumamoto.png', fullPage: true });
  // delete a pack card, reload: stays deleted
  await p.click('nav >> text=Cards'); await p.fill('input[type=search]', 'Degawa'); await p.click('li:has-text("Tetsuro Degawa")');
  await p.click('button.danger:has-text("Delete this card")'); await p.click('button.danger:has-text("Tap again")');
  await p.waitForSelector('input[type=search]');
  await p.reload(); await p.waitForSelector('text=What to study'); await p.click('nav >> text=Cards');
  ok((await p.innerText('.muted >> text=of ')).includes('of 96 cards'), 'deleted pack card stays deleted: ' + (await p.innerText('.muted >> text=of ')));
  // sex group + study works with new cards: Faces->English multiple choice 2, all persons
  console.log('errors', errs); await b.close();
})();
