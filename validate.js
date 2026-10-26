#!/usr/bin/env node
/* Valide la géométrie des niveaux : objets dans le décor, cheminements impossibles, etc. */
const fs = require('fs');
const src = fs.readFileSync('src/levels.js', 'utf8');
const LEVELS = eval(src.replace('const LEVELS =', '(') .replace(/;\s*$/, ')'));
const T = 40, VW = 1280, VH = 720;
let errors = 0, warns = 0;
const err = (m) => { errors++; console.log('  ✗ ' + m); };
const warn = (m) => { warns++; console.log('  ! ' + m); };
const hit = (a, b) => a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];

LEVELS.forEach((L, li) => {
  console.log(`\n=== N${li + 1} ${L.name} (${L.width / T} tuiles) ===`);
  const solids = L.solids.map(s => [s[0], s[1], s[2], s[3]]);
  const plats = L.plats.map(p => [p[0], p[1], p[2], 10]);
  const crumbles = L.crumbles.map(c => [c[0], c[1], c[2], 10]);
  const spikes = L.spikes;
  const inSolid = (r) => solids.some(s => hit(r, s));
  const inSpike = (r) => spikes.some(s => hit(r, s));

  // pièces / gemmes
  L.coins.forEach(([x, y]) => {
    const r = [x - 7, y - 7, 14, 14];
    if (inSolid(r)) err(`pièce dans un mur @ ${x / T},${y / T}`);
  });
  L.gems.forEach(([x, y]) => {
    const r = [x - 12, y - 12, 24, 24];
    if (inSolid(r)) err(`gemme dans un mur @ ${x / T},${y / T}`);
  });
  // pics
  spikes.forEach(s => { if (inSolid([s[0], s[1] + 4, s[2], s[3] - 8])) err(`pics dans un mur @ ${s[0] / T}`); });
  // plateformes / friables dans les murs
  [...L.plats, ...L.crumbles].forEach(p => {
    if (inSolid([p[0], p[1], p[2], 8])) err(`plateforme dans un mur @ ${p[0] / T},${p[1] / T}`);
  });
  // ennemis
  L.enemies.forEach(e => {
    const r = [e.x, e.y - e.h, e.w, e.h];
    if (inSolid(r)) err(`ennemi ${e.t} dans un mur @ ${e.x / T},${e.y / T}`);
    if (e.t !== 'flyer') {
      const foot = [e.x + 4, e.y + 2, e.w - 8, 6];
      if (!solids.some(s => hit(foot, s)) && !plats.some(s => hit(foot, s))) warn(`ennemi ${e.t} sans sol @ ${e.x / T}`);
    }
  });
  // ressorts
  L.springs.forEach(sp => {
    const foot = [sp[0], sp[1] + sp[3] + 2, sp[2], 6];
    if (!solids.some(s => hit(foot, s))) err(`ressort flottant @ ${sp[0] / T}`);
    if (inSolid(sp)) err(`ressort dans un mur @ ${sp[0] / T}`);
  });
  // checkpoints / goal sur un sol
  [...L.checkpoints, L.goal].forEach(c => {
    const foot = [c[0] - 12, c[1] + 2, 24, 6];
    if (!solids.some(s => hit(foot, s)) && !plats.some(s => hit(foot, s))) err(`checkpoint/goal flottant @ ${c[0] / T}`);
  });
  // départ
  const st = [L.start[0] + 6, L.start[1] - 36, 26, 34];
  if (inSolid(st)) err('départ dans un mur');
  if (!solids.some(s => hit([st[0], L.start[1] + 2, 26, 6], s))) err('départ sans sol');

  // plateformes mobiles : trajectoire libre
  L.movers.forEach(m => {
    const [x, y, w, axis, dist] = m;
    const r0 = axis === 'x' ? [x, y - 8, w + dist, 16] : [x, y - 8, w, dist + 16];
    solids.forEach(s => { if (hit(r0, s)) err(`mobile ${axis} traverse un mur @ ${x / T},${y / T}`); });
    // portée maximale depuis les bords de niveau
    if (x + w + dist > L.width - 40) err(`mobile dépasse la largeur @ ${x / T}`);
  });

  // --- atteignabilité : graphe de surfaces + mobiles + ressorts
  // capacités : saut simple (dx 230 / haut 150), double saut+dash (dx 430 / haut 260), descente 520
  const nodes = [];
  solids.forEach(s => { for (let x = s[0] + 20; x < s[0] + s[2]; x += 40) nodes.push({ x, y: s[1], tag: 'sol' }); });
  [...L.plats, ...L.crumbles].forEach(p => {
    for (let x = p[0] + 20; x < p[0] + p[2]; x += 40) nodes.push({ x, y: p[1], tag: 'plat' });
  });
  // trajectoires des plateformes mobiles
  L.movers.forEach(m => {
    const [x, y, w, axis, dist] = m;
    for (let d = 0; d <= dist; d += 20) {
      const px = axis === 'x' ? x + d : x, py = axis === 'y' ? y + d : y;
      for (let wx = px + 10; wx < px + w; wx += 20) nodes.push({ x: wx, y: py, tag: 'mover' });
    }
  });
  // tremplins
  L.springs.forEach(sp => {
    nodes.push({ x: sp[0] + 18, y: sp[1], tag: 'spring' });
    nodes.push({ x: sp[0] + 18, y: sp[1] - 360, tag: 'springapex' });
  });
  const key = n => Math.round(n.x / 8) + ':' + Math.round(n.y / 8);
  const startNode = nodes.reduce((b, n) => (Math.abs(n.x - L.start[0]) + Math.abs(n.y - L.start[1]) < Math.abs(b.x - L.start[0]) + Math.abs(b.y - L.start[1]) ? n : b), nodes[0]);
  const seen = new Map([[key(startNode), startNode]]);
  const q = [startNode];
  while (q.length) {
    const a = q.shift();
    for (const b of nodes) {
      if (seen.has(key(b))) continue;
      const dx = Math.abs(b.x - a.x);
      const up = a.y - b.y;   // >0 : b plus haut
      const down = b.y - a.y;
      if (a.tag === 'springapex') { // depuis l'apex du ressort on retombe
        if (dx <= 320 && down <= 520) { seen.set(key(b), b); q.push(b); }
        continue;
      }
      if (a.tag === 'spring') continue; // on ne saute pas depuis un ressort
      if (dx <= 430 && up <= 260 && down <= 520) { seen.set(key(b), b); q.push(b); }
    }
  }
  const goalNode = nodes.reduce((b, n) => (Math.abs(n.x - L.goal[0]) + Math.abs(n.y - L.goal[1]) < Math.abs(b.x - L.goal[0]) + Math.abs(b.y - L.goal[1]) ? n : b), nodes[0]);
  if (!seen.has(key(goalNode))) err(`GOAL non atteignable (${L.goal[0] / T},${L.goal[1] / T})`);

  // orphelins (indice)
  const orphans = nodes.filter(n => !seen.has(key(n)) && n.y < 600 && n.tag !== 'springapex');
  if (orphans.length) {
    const uniq = [...new Set(orphans.map(o => `${o.x / T},${o.y / T}`))].slice(0, 8);
    warn(`${orphans.length} surfaces non atteintes (${uniq.join(' | ')})`);
  }
  console.log(`  ${L.coins.length} pièces · ${L.gems.length} gemmes · ${L.enemies.length} ennemis · ${seen.size}/${nodes.length} noeuds atteints`);
});

console.log(`\n${errors} erreur(s), ${warns} avertissement(s)`);
process.exit(errors ? 1 : 0);
