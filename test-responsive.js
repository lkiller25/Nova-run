const { chromium, devices } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const url = 'file://' + path.resolve('nova-run.html');
  const errors = [];

  // ---------- mobile paysage (tactile)
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('M: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('MC: ' + m.text()); });
  await page.goto(url);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'shots/m1-menu.png' });
  const touchVisible = await page.evaluate(() => !document.getElementById('touch').classList.contains('hidden'));
  await page.tap('#btnPlay');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'shots/m2-intro.png' });
  await page.tap('#btnStart');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'shots/m3-play.png' });
  const layout = await page.evaluate(() => {
    const f = document.getElementById('frame').getBoundingClientRect();
    const t = document.getElementById('touch').getBoundingClientRect();
    return { frame: [Math.round(f.width), Math.round(f.height)], touch: [Math.round(t.width), Math.round(t.height)], screen: Game.screen };
  });
  console.log('MOBILE PAYSAGE', JSON.stringify({ touchVisible, layout }));

  // boutons tactiles : appui maintenu
  const btn = await page.$('.tbtn.jump');
  const box = await btn.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  const jumped = await page.evaluate(() => ({ vy: Math.round(Game.player.vy), y: Math.round(Game.player.y) }));
  console.log('TAP SAUT', JSON.stringify(jumped));

  // ---------- mobile portrait
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', e => errors.push('P: ' + e.message));
  await p2.goto(url);
  await p2.waitForTimeout(900);
  await p2.screenshot({ path: 'shots/m4-portrait.png' });
  const portrait = await p2.evaluate(() => {
    const f = document.getElementById('frame').getBoundingClientRect();
    return { frame: [Math.round(f.width), Math.round(f.height)], bodyScroll: [document.body.scrollWidth, document.body.scrollHeight] };
  });
  console.log('MOBILE PORTRAIT', JSON.stringify(portrait));

  // ---------- petit écran desktop
  const ctx3 = await browser.newContext({ viewport: { width: 1024, height: 600 } });
  const p3 = await ctx3.newPage();
  await p3.goto(url);
  await p3.waitForTimeout(800);
  await p3.click('#btnLevels');
  await p3.waitForTimeout(500);
  await p3.screenshot({ path: 'shots/m5-levels-1024.png' });

  // ---------- grand écran : après modifs visuelles
  const ctx4 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p4 = await ctx4.newPage();
  p4.on('pageerror', e => errors.push('D: ' + e.message));
  await p4.goto(url);
  await p4.waitForTimeout(900);
  await p4.screenshot({ path: 'shots/d1-menu.png' });
  await p4.click('#btnPlay'); await p4.waitForTimeout(300);
  await p4.keyboard.press('Space'); await p4.waitForTimeout(1200);
  await p4.screenshot({ path: 'shots/d2-play.png' });
  await p4.evaluate(() => { Engine.loadLevel(2); Game.screen = 'play'; UI.showScreen(null); Game.player.x = 640; Game.player.y = 520; Game.cam.x = 300; });
  await p4.waitForTimeout(900);
  await p4.screenshot({ path: 'shots/d3-ressort.png' });
  await p4.evaluate(() => { Engine.loadLevel(4); Game.screen = 'play'; UI.showScreen(null); Game.player.x = 1000; Game.player.y = 520; Game.cam.x = 700; });
  await p4.waitForTimeout(900);
  await p4.screenshot({ path: 'shots/d4-orage.png' });
  await p4.evaluate(() => { Game.screen = 'levels'; UI.showScreen('levels'); });
  await p4.waitForTimeout(600);
  await p4.screenshot({ path: 'shots/d5-levels.png' });

  console.log('ERREURS:', errors.length ? JSON.stringify(errors.slice(0, 5)) : 'aucune');
  await browser.close();
})();
