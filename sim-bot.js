#!/usr/bin/env node
/* Bot headless (sans navigateur) : charge levels.js + game.js dans Node avec des
   stubs et pilote Input directement. Repère les blocages durs et vérifie que
   chaque niveau est terminable avec la vraie physique. Usage : node sim-bot.js [5,6,7] */
const fs = require('fs');

global.window = global;
global.Sound = new Proxy({}, { get: () => () => {} });

const levelsPath = fs.existsSync('src/levels.js') ? 'src/levels.js' : 'levels.js';
const gamePath = fs.existsSync('src/game.js') ? 'src/game.js' : 'game.js';
// un seul eval : les const du premier fichier restent visibles du second
eval(fs.readFileSync(levelsPath, 'utf8') + '\n' + fs.readFileSync(gamePath, 'utf8'));

const T = 40;

// PRNG déterministe : sinon les minuteurs aléatoires des ennemis rendent chaque
// exécution différente et empêchent de régler finement la stratégie du bot
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const targets = process.argv[2]
  ? process.argv[2].split(',').map(Number)
  : LEVELS.map((_, i) => i);

function runLevel(idx) {
  Math.random = mulberry32(1337 + idx * 97);
  Game.idx = idx;
  Engine.loadLevel(idx);
  Game.screen = 'play';
  Game.player.invuln = 99999;
  const p = Game.player, L = Game.level;
  const sol = (c, r) => {
    if (c < 0 || c >= L.cols) return true;
    if (r < 0 || r >= 18) return false;
    return L.grid[r * L.cols + c] === 1;
  };
  const platAt = (x, y0, y1) =>
    L.plats.some(q => x > q.x - 8 && x < q.x + q.w + 8 && q.y >= y0 && q.y <= y1) ||
    L.crumbles.some(q => q.state !== 'gone' && x > q.x - 8 && x < q.x + q.w + 8 && q.y >= y0 && q.y <= y1) ||
    L.movers.some(q => x > q.x - 8 && x < q.x + q.w + 8 && q.y >= y0 && q.y <= y1);

  let maxX = 0, lastX = p.x, stuckT = 0, stuckAt = null;
  const deathTiles = {};
  let wasDead = false;
  let jumpHeld = false, jumpUntil = 0, jumpReleased = true;
  let dashHeld = false, dashUntil = 0, dashReleased = true;
  let steer = 0, steerT = 0;   // direction forcée après un saut mural (zig-zag)
  const t0 = Game.time;
  let guard = 0;
  const MAXT = 60 * 150; // 150 s de temps de jeu max

  while (Game.screen === 'play' && guard++ < MAXT) {
    const now = Game.time;
    const feet = p.y + p.h;
    const colAhead = Math.floor((p.x + p.w + 14) / T), rowMid = Math.floor((p.y + p.h * 0.5) / T);
    const wall = sol(colAhead, rowMid) && sol(colAhead, rowMid - 1);
    // surface d'atterrissage à hauteur des pieds (±40 px) : les plateformes
    // très hautes ne doivent PAS empêcher de sauter au bord d'un gouffre.
    // On compte aussi comme sûre une terre ferme (rangée 15) dans les 160 px :
    // depuis un radeau mobile on peut s'y laisser tomber sans sauter.
    const solidAheadLow = sol(Math.floor((p.x + p.w + 60) / T), 15);
    const groundAhead = sol(Math.floor((p.x + p.w + 24) / T), Math.floor((feet + 14) / T)) ||
      platAt(p.x + p.w + 24, feet - 40, feet + 100) || solidAheadLow;
    const deepGap = !sol(Math.floor((p.x + p.w + 30) / T), Math.floor((feet + 70) / T)) &&
      !platAt(p.x + p.w + 30, feet - 6, feet + 220);
    // terre ferme ou plateforme directement sous le joueur : fiable même en altitude
    const cMid = Math.floor((p.x + p.w / 2) / T);
    const groundBelow = sol(cMid, 15) || sol(cMid + 1, 15) ||
      platAt(p.x + p.w / 2, feet - 4, feet + 280);
    const realGap = deepGap && !groundBelow;
    // une plateforme/dalle devant, à portée de l'arc en cours : garder le double saut
    const allSurfaces = L.plats.concat(L.crumbles.filter(c => c.state !== 'gone'), L.movers);
    const landingAhead = allSurfaces.some(q =>
      q.x + q.w > p.x + p.w && q.x < p.x + p.w + 190 && q.y > feet - 220 && q.y < feet + 70);
    // piques au sol dans les ~50 px devant : saut d'anticipation
    const spikeAhead = L.spikes.some(s =>
      p.x + p.w + 6 < s.x + s.w && p.x + p.w + 52 > s.x &&
      Math.abs(feet - (s.y + s.h)) < 46);
    // gouffre franchi par un mobile : attendre qu'il soit à portée avant de s'élancer
    let wait = false;
    if (p.onGround && !groundAhead) {
      const mv = L.movers
        .filter(m => m.x > p.x - 20 && m.x < p.x + 560 && Math.abs(m.y - feet) < 280)
        .sort((a, b) => a.x - b.x)[0];
      if (mv && mv.axis === 'x' && mv.x - (p.x + p.w) > 95) wait = true;
    }
    // petit bond entre dalles friables / plateformes proches : garder l'appui court
    let shortHop = false;
    if (p.ride && (p.ride.kind === 'crumble')) {
      const next = [...L.crumbles, ...L.plats].find(q =>
        q.state !== 'gone' && q.x > p.x + p.w - 4 && q.x < p.x + p.w + 150 && Math.abs(q.y - p.ride.y) < 40);
      if (next) shortHop = true;
    }
    // sur un ascenseur vertical, sauter quand il est près de son point haut
    let liftJump = false;
    if (p.ride && p.ride.kind === 'mover' && p.ride.axis === 'y') {
      if (p.ride.y <= p.ride.y0 + 30) liftJump = true;
    }
    const needJump = (p.onGround && (wall || !groundAhead || spikeAhead || liftJump || stuckT > 0.35)) ||
      (!p.onGround && p.wallDir !== 0 && p.vy > 0);

    steerT = Math.max(0, steerT - 1 / 60);
    if (needJump && !p.onGround && p.wallDir !== 0 && p.vy > 0) {
      // saut mural : partir du côté opposé pour enchaîner en zig-zag
      steer = -p.wallDir; steerT = 0.24;
    }
    Input.left = steerT > 0 && steer < 0;
    Input.right = steerT > 0 ? steer > 0 : !wait;
    Input.down = false;
    // un nouvel appui exige une frame complète de relâchement (front descendant
    // synchronisé), sinon le double saut ne voit jamais de nouveau front montant.
    // On garde l'appui 0.26 s pour un saut complet (sinon le cut vélocité fait
    // un petit hop qui retombe dans les piques / les gouffres).
    if (needJump && !jumpHeld && jumpReleased) { jumpHeld = true; jumpUntil = now + (shortHop ? 0.1 : 0.26); jumpReleased = false; }
    if (jumpHeld && now > jumpUntil) jumpHeld = false;
    // double saut seulement en chute franche, près du niveau du sol, et sans
    // terre ferme dessous : sinon le bot gaspille son deuxième saut pour rien
    if (!p.onGround && !jumpHeld && jumpReleased && p.jumps < 2 && p.wallDir === 0 &&
        p.vy > 120 && feet > 440 && (realGap || (spikeAhead && !groundBelow))) {
      jumpHeld = true; jumpUntil = now + 0.24; jumpReleased = false;
    }
    const needDash = !p.onGround && p.vy > 150 && realGap;
    if (needDash && !dashHeld && dashReleased) { dashHeld = true; dashUntil = now + 0.09; dashReleased = false; }
    if (dashHeld && now > dashUntil) dashHeld = false;
    // jumpHeld pilote la hauteur variable du saut : sans lui, le moteur coupe
    // systématiquement la vélocité à -310 (mini-saut)
    Input.jump = jumpHeld; Input.jumpHeld = jumpHeld; Input.dash = dashHeld;

    Input.syncEdges();
    Engine.tick(1 / 60);
    // respawn() remet l'invulnérabilité à 0.9 s : on la prolonge pour que le
    // bot ne meure que des gouffres et des piques (vrais tests de géométrie)
    p.invuln = 99999;
    // pendant une mort/respawn, tout relâcher pour repartir proprement
    if (p.dead) { jumpHeld = false; dashHeld = false; jumpReleased = true; dashReleased = true; steer = 0; steerT = 0; }
    jumpReleased = !jumpHeld;
    dashReleased = !dashHeld;

    if (p.dead && !wasDead) {
      const t = Math.round(p.x / T);
      deathTiles[t] = (deathTiles[t] || 0) + 1;
    }
    wasDead = p.dead;
    if (Math.abs(p.x - lastX) < 0.5) { if (!wait) stuckT += 1 / 60; }
    else { stuckT = 0; stuckAt = null; }
    if (stuckT > 1.2 && !stuckAt) stuckAt = Math.round(p.x / T);
    lastX = p.x;
    if (p.x > maxX) maxX = p.x;
  }
  Input.reset();
  return {
    idx, name: L.def.name,
    won: Game.screen === 'complete',
    progress: Math.round(maxX / L.goal.x * 100),
    stuckAt: stuckAt !== null ? stuckAt + ' tuile' : null,
    deaths: Game.run.deaths, coins: Game.run.coins + '/' + L.coins.length,
    time: +(Game.time - t0).toFixed(1),
    morts: Object.entries(deathTiles).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t, n]) => t + '×' + n),
  };
}

let failures = 0;
for (const idx of targets) {
  const r = runLevel(idx);
  if (!r.won) failures++;
  console.log((r.won ? '✓' : '✗') + ' N' + (r.idx + 1) + ' ' + r.name.padEnd(20) +
    ' ' + JSON.stringify(r));
}
console.log(failures ? `\n${failures} niveau(x) non terminé(s)` : '\nTous les niveaux sont terminables.');
process.exit(failures ? 1 : 0);
