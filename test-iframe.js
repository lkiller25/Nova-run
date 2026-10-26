const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  // page hôte qui charge le jeu dans une iframe sandbox="allow-scripts"
  const host = path.resolve('tools/host.html');
  fs.writeFileSync(host, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#05030c}iframe{border:0;width:100%;height:100%}</style>
<iframe sandbox="allow-scripts" src="../nova-run.html"></iframe>`);

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGE: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONS: ' + m.text()); });
  await p.goto('file://' + host);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: 'shots/iframe-menu.png' });

  const frame = p.frames().find(f => f.url().includes('nova-run'));
  const st1 = await frame.evaluate(() => { let ls = 'ok'; try { ls = typeof localStorage.getItem; } catch (e) { ls = 'bloqué'; } return { screen: Game.screen, levels: LEVELS.length, localStorage: ls }; });
  // tenter de jouer : clic dans l'iframe
  await frame.click('#btnPlay');
  await p.waitForTimeout(400);
  await frame.click('#btnStart');
  await p.waitForTimeout(1200);
  await p.screenshot({ path: 'shots/iframe-play.png' });
  const st2 = await frame.evaluate(() => ({ screen: Game.screen, x: Math.round(Game.player.x), time: +Game.run.time.toFixed(1) }));

  // écrire une sauvegarde doit échouer proprement
  const st3 = await frame.evaluate(() => { try { localStorage.setItem('t', '1'); return 'localStorage OK'; } catch (e) { return 'localStorage bloqué (géré)'; } });
  console.log('IFRAME', JSON.stringify({ st1, st2, st3, errs: errs.filter(e => !/localStorage|AudioContext|autoplay|Permissions/i.test(e)) }));
  console.log('TOUTES ERREURS:', errs.length ? JSON.stringify(errs.slice(0, 6)) : 'aucune');
  await b.close();
})();
