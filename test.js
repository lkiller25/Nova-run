const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));

  await page.goto('file://' + path.resolve('nova-run.html'));
  await page.waitForTimeout(1000);
  fs.mkdirSync('shots', { recursive: true });
  const shot = (n) => page.screenshot({ path: 'shots/' + n + '.png' });

  await shot('01-menu');

  // ---- mesures physiques (entrées réelles via le clavier)
  await page.click('#btnPlay');
  await page.waitForTimeout(400);
  await page.keyboard.press('Space');
  await page.waitForTimeout(600);

  async function physicsProbe() {
    return page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const p = Game.player;
      const waitGround = async () => { for (let i = 0; i < 200 && !p.onGround; i++) await sleep(10); };
      const measure = async (fn) => {
        await waitGround(); await sleep(150);
        const y0 = p.y, x0 = p.x;
        let minY = 1e9, maxX = -1e9, minX = 1e9;
        fn();
        for (let i = 0; i < 150; i++) { await sleep(10); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); minX = Math.min(minX, p.x); }
        await waitGround();
        return { h: Math.round(y0 - minY), dx: Math.round(maxX - x0), dxl: Math.round(x0 - minX) };
      };
      const key = (code, type) => window.dispatchEvent(new KeyboardEvent(type, { key: code, bubbles: true }));
      const down = (k) => key(k, 'keydown'), up = (k) => key(k, 'keyup');

      // saut simple sur place
      const single = await measure(() => { down(' '); setTimeout(() => up(' '), 260); });
      // double saut
      const dbl = await measure(() => { down(' '); setTimeout(() => up(' '), 120); setTimeout(() => down(' '), 260); setTimeout(() => up(' '), 420); });
      // course + saut
      const runJump = await measure(() => { down('ArrowRight'); down(' '); setTimeout(() => up(' '), 300); setTimeout(() => up('ArrowRight'), 1200); });
      // dash au sol
      const dash = await measure(() => { down('ArrowRight'); setTimeout(() => { down('Shift'); setTimeout(() => up('Shift'), 40); }, 120); setTimeout(() => up('ArrowRight'), 1200); });
      // vitesse de course
      await waitGround(); await sleep(200);
      const xa = p.x; down('ArrowRight'); await sleep(700); const vRun = Math.round(p.vx); const xb = p.x; up('ArrowRight');
      return { single, dbl, runJump, dash, vRun };
    });
  }
  const phys = await physicsProbe();
  console.log('PHYSIQUE', JSON.stringify(phys));
  await shot('02-play-start');

  // ---- captures par niveau (téléportation + caméra stabilisée)
  const spots = [
    [0, 60, 'plates-formes'], [0, 95, 'dalles'], [1, 22, 'gouffre'], [1, 47, 'puits mur'], [1, 84, 'vide plateformes'],
    [2, 10, 'ressort'], [2, 20, 'mobile'], [2, 50, 'friables'], [3, 15, 'iles'], [3, 36, 'puits'], [3, 70, 'mobiles'],
    [4, 30, 'puits final'], [4, 62, 'gouffre géant'], [4, 100, 'friables'], [4, 172, 'arrivée'],
  ];
  for (const [idx, tileX, label] of spots) {
    await page.evaluate(({ idx, tileX }) => {
      Engine.loadLevel(idx);
      Game.screen = 'play';
      const L = Game.level;
      Game.player.x = tileX * 40;
      Game.player.y = 560;
      Game.player.invuln = 99;
      Game.cam.x = Math.max(0, Math.min(L.width - VISW, tileX * 40 - VISW / 2));
      Game.cam.y = 175;
    }, { idx, tileX });
    await page.waitForTimeout(650);
    await page.evaluate(() => { Game.player.invuln = 99; });
    await page.waitForTimeout(300);
    await shot('lvl' + (idx + 1) + '-' + String(tileX).padStart(3, '0') + '-' + label.replace(/\s+/g, '_'));
  }

  // ---- écran pause / mondes / fin
  await page.evaluate(() => { Engine.loadLevel(2); Game.screen = 'play'; UI.showScreen(null); });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await shot('03-pause');
  await page.keyboard.press('Escape');

  await page.evaluate(() => { Game.screen = 'levels'; UI.showScreen('levels'); });
  await page.waitForTimeout(500);
  await shot('04-mondes');

  // fin de niveau factice
  await page.evaluate(() => {
    Engine.loadLevel(1);
    Game.screen = 'play'; UI.showScreen(null);
    Game.run = { time: 78.4, deaths: 2, coins: 33, gems: 2 };
    Game.player.x = Game.level.goal.x - 30;
    Game.player.y = Game.level.goal.y - 40;
    Game.player.invuln = 999;
  });
  await page.waitForTimeout(1200);
  await shot('05-complete');
  const complete = await page.evaluate(() => ({ screen: Game.screen, result: Game.result }));
  console.log('COMPLETE', JSON.stringify(complete));

  await page.evaluate(() => { document.getElementById('btnNext').click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    Game.screen = 'ending';
    UI.showScreen('ending');
  });
  await page.waitForTimeout(700);
  await shot('06-ending');

  console.log('ERREURS:', errors.length ? JSON.stringify(errors, null, 1) : 'aucune');
  await browser.close();
})();
