const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/-home-user/77587700-1482-5af7-9d38-099b28ee21ee/scratchpad/shots/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  await p.goto('http://localhost:4173/');
  await p.waitForTimeout(1200);
  await p.screenshot({ path: OUT + '01-dash-empty.png', fullPage: true });
  // Demo laden
  await p.goto('http://localhost:4173/#profil'); await p.waitForTimeout(500);
  await p.getByRole('button', { name: 'Beispieldaten laden' }).click(); await p.waitForTimeout(800);
  await p.goto('http://localhost:4173/#uebersicht'); await p.waitForTimeout(800);
  await p.screenshot({ path: OUT + '02-dash-demo.png', fullPage: true });
  // Training
  await p.goto('http://localhost:4173/#training'); await p.waitForTimeout(600);
  await p.screenshot({ path: OUT + '03-training-plan.png', fullPage: true });
  await p.getByRole('button', { name: 'Training starten' }).first().click(); await p.waitForTimeout(600);
  await p.getByRole('button', { name: 'Satz abschließen' }).first().click(); await p.waitForTimeout(400);
  await p.getByRole('button', { name: 'Satz abschließen' }).first().click(); await p.waitForTimeout(1200);
  await p.screenshot({ path: OUT + '04-workout.png', fullPage: false });
  // reload persists?
  await p.reload(); await p.waitForTimeout(1200);
  const persisted = await p.getByText('Beenden').count();
  console.log('active after reload:', persisted);
  await p.getByRole('button', { name: 'Beenden', exact: true }).click(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'Speichern & beenden' }).click(); await p.waitForTimeout(600);
  await p.screenshot({ path: OUT + '05-summary.png' });
  for (const r of ['muskeln', 'fortschritt', 'ernaehrung', 'kalender', 'uebungen', 'profil', 'wissenschaft']) {
    await p.goto('http://localhost:4173/#' + r); await p.waitForTimeout(700);
    await p.screenshot({ path: OUT + `10-${r}.png`, fullPage: true });
  }
  const desk = await b.newPage({ viewport: { width: 1400, height: 900 } });
  desk.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  await desk.goto('http://localhost:4173/#uebersicht'); await desk.waitForTimeout(1200);
  await desk.screenshot({ path: OUT + '20-desk-dash.png' });
  await desk.goto('http://localhost:4173/#muskeln'); await desk.waitForTimeout(800);
  await desk.screenshot({ path: OUT + '21-desk-muscles.png' });
  console.log('ERRORS:', errs.slice(0, 10));
  await b.close();
})();
