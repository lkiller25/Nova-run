const { chromium } = require('playwright');
const path = require('path');

/* Bot volontairement simple : court à droite, saute devant un mur ou un gouffre,
   dashe quand il chute dans le vide. Objectif : repérer les blocages durs. */

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('file://' + path.resolve('nova-run.html'));
  await page.waitForTimeout(700);

  for (const idx of (process.env.LEVELS ? process.env.LEVELS.split(',').map(Number) : [0,1,2,3,4])) {
    const res = await page.evaluate(async (idx) => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const key = (k, type) => window.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true }));
      Engine.loadLevel(idx); Game.screen = 'play'; UI.showScreen(null);
      Game.player.invuln = 99999;
      const p = Game.player, L = Game.level;
      const sol = (c, r) => { if (c < 0 || c >= L.cols) return true; if (r < 0 || r >= 18) return false; return L.grid[r * L.cols + c] === 1; };
      const platAt = (x, y0, y1) => L.plats.some(q => x > q.x - 8 && x < q.x + q.w + 8 && q.y >= y0 && q.y <= y1) ||
                                L.movers.some(q => x > q.x - 8 && x < q.x + q.w + 8 && q.y >= y0 && q.y <= y1);
      let maxX = 0, lastX = p.x, stuckAt = null, stuckT = 0;
      const deathTiles = {};
      let wasDead = false;
      key('ArrowRight', 'keydown');
      let jumpHeld = false, jumpUntil = 0, dashHeld = false, dashUntil = 0;
      const t0 = performance.now();
      while (performance.now() - t0 < 40000) {
        await sleep(16);
        if (Game.screen !== 'play') break;
        const now = performance.now();
        const feet = p.y + p.h;
        const colAhead = Math.floor((p.x + p.w + 14) / 40), rowMid = Math.floor((p.y + p.h * 0.5) / 40);
        const wall = sol(colAhead, rowMid) && sol(colAhead, rowMid - 1);
        const groundAhead = sol(Math.floor((p.x + p.w + 24) / 40), Math.floor((feet + 14) / 40)) || platAt(p.x + p.w + 24, feet - 6, feet + 100);
        const deepGap = !sol(Math.floor((p.x + p.w + 30) / 40), Math.floor((feet + 70) / 40)) && !platAt(p.x + p.w + 30, feet - 6, feet + 220);
        const needJump = (p.onGround && (wall || !groundAhead || stuckT > 0.35)) ||
                         (!p.onGround && p.wallDir !== 0 && p.vy > 0);
        if (needJump && !jumpHeld) { key(' ', 'keydown'); jumpHeld = true; jumpUntil = now + 170; }
        if (jumpHeld && now > jumpUntil) { key(' ', 'keyup'); jumpHeld = false; }
        if (!p.onGround && !jumpHeld && p.jumps < 2 && p.vy > -60 && deepGap) { key(' ', 'keydown'); jumpHeld = true; jumpUntil = now + 150; }
        const needDash = !p.onGround && p.vy > 150 && deepGap;
        if (needDash && !dashHeld) { key('Shift', 'keydown'); dashHeld = true; dashUntil = now + 90; }
        if (dashHeld && now > dashUntil) { key('Shift', 'keyup'); dashHeld = false; }
        if (p.dead && !wasDead) { const t = Math.round(Game.lastDeathX / 40); deathTiles[t] = (deathTiles[t] || 0) + 1; }
        wasDead = p.dead;
        if (Math.abs(p.x - lastX) < 0.5) stuckT += 0.016; else { stuckT = 0; stuckAt = null; }
        if (stuckT > 1.2 && !stuckAt) stuckAt = Math.round(p.x);
        lastX = p.x;
        if (p.x > maxX) maxX = p.x;
      }
      key('ArrowRight', 'keyup'); if (jumpHeld) key(' ', 'keyup'); if (dashHeld) key('Shift', 'keyup');
      const goalX = L.goal.x;
      return {
        idx, name: L.def.name, goalX, maxX: Math.round(maxX),
        progress: Math.round(maxX / goalX * 100), stuckAt: stuckAt ? Math.round(stuckAt / 40) + ' tuile' : null,
        screen: Game.screen, coins: Game.run.coins, deaths: Game.run.deaths,
        morts: Object.entries(deathTiles).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([t,n])=>t+'×'+n),
        time: +Game.run.time.toFixed(1), won: !!Game.result,
      };
    }, idx);
    console.log('BOT ' + JSON.stringify(res));
    if (res.screen === 'complete') {
      await page.evaluate(() => { Game.screen = 'play'; UI.showScreen(null); });
    }
  }
  console.log('ERREURS:', errors.length ? JSON.stringify(errors.slice(0, 3)) : 'aucune');
  await browser.close();
})();
