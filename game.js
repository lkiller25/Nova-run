/* ============================================================
   NOVA RUN — moteur de jeu (physique, entités, boucle)
   ============================================================ */
const T = 40, VW = 1280, VH = 720, ROWS = 18;
const ZOOM = 1.34;               // grossissement du monde à l'écran
const VISW = VW / ZOOM, VISH = VH / ZOOM;   // fenêtre visible en pixels monde

const PHYS = {
  spd: 330, accG: 3000, decG: 3900, accA: 2200, decA: 1050,
  g: 2500, fallMult: 1.18, maxFall: 1020,
  jump: -860, jump2: -760, spring: -1350,
  coyote: 0.1, buffer: 0.14,
  wallSlide: 200, wallGravity: 0.34, wallJumpX: 430, wallJumpY: -800, wallLock: 0.15,
  dashSpd: 790, dashT: 0.15, dashCd: 0.45,
  stompBounce: -540,
};

const Input = {
  left: false, right: false, down: false, jump: false, jumpHeld: false, dash: false,
  jumpEdge: false, dashEdge: false, _pj: false, _pd: false,
  syncEdges() {
    if (this.jump && !this._pj) this.jumpEdge = true;
    if (this.dash && !this._pd) this.dashEdge = true;
    this._pj = this.jump; this._pd = this.dash;
  },
  clearEdges() { this.jumpEdge = false; this.dashEdge = false; },
  reset() {
    this.left = this.right = this.down = this.jump = this.jumpHeld = this.dash = false;
    this.jumpEdge = this.dashEdge = false; this._pj = this._pd = false;
  },
};

const Game = {
  screen: 'menu',          // menu | levels | intro | play | pause | complete | ending
  idx: 0,
  level: null,
  player: null,
  run: { time: 0, deaths: 0, coins: 0, gems: 0 },
  result: null,
  cam: { x: 0, y: 0, shake: 0 },
  particles: [], floats: [], weather: [],
  time: 0,
  flash: 0, flashColor: '#ffffff',
  combo: 0, comboT: -9,
  events: [],
  hintsShown: {},
  spawnX: 0, spawnY: 0,
  lightningT: 5, lightning: 0, thunderT: -1,
  lastLandVy: 0,
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const sgn = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
const approach = (v, target, max) => (v < target ? Math.min(v + max, target) : Math.max(v - max, target));
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function emit(type, data) { Game.events.push(Object.assign({ type }, data)); }

/* ============================================================ NIVEAU */
function loadLevel(idx) {
  const def = LEVELS[idx];
  const cols = Math.ceil(def.width / T);
  const L = {
    def, idx, width: def.width, theme: def.theme, cols, rows: ROWS,
    grid: new Uint8Array(cols * ROWS),
    plats: [], movers: [], crumbles: [], coins: [], gems: [], spikes: [],
    enemies: [], springs: [], checkpoints: [],
    goal: { x: def.goal[0], y: def.goal[1] },
  };
  def.solids.forEach(([x, y, w, h]) => {
    const c0 = Math.max(0, Math.floor(x / T)), c1 = Math.min(cols - 1, Math.ceil((x + w) / T) - 1);
    const r0 = Math.max(0, Math.floor(y / T)), r1 = Math.min(ROWS - 1, Math.ceil((y + h) / T) - 1);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) L.grid[r * cols + c] = 1;
  });
  L.plats = def.plats.map(([x, y, w]) => ({ x, y, w, h: 12, oneWay: true, kind: 'plat' }));
  L.movers = def.movers.map(([x, y, w, axis, dist, speed, phase]) => ({
    x0: x, y0: y, x, y, w, h: 14, axis, dist, speed, phase, dx: 0, dy: 0, oneWay: true, kind: 'mover',
  }));
  L.crumbles = def.crumbles.map(([x, y, w]) => ({
    x, y, w, h: 12, state: 'idle', t: 0, oneWay: true, kind: 'crumble',
  }));
  L.coins = def.coins.map(([x, y], i) => ({ x, y, got: false, phase: i * 0.7 }));
  L.gems = def.gems.map(([x, y], i) => ({ x, y, got: false, phase: i * 1.3 }));
  L.spikes = def.spikes.map(([x, y, w, h]) => ({ x, y, w, h }));
  L.springs = def.springs.map(([x, y, w, h]) => ({ x, y, w, h, t: 0 }));
  L.checkpoints = def.checkpoints.map(([x, y]) => ({ x, y, active: false, t: 0 }));
  L.enemies = def.enemies.map((e, i) => ({
    t: e.t, x: e.x, w: e.w, h: e.h,
    y: e.t === 'flyer' ? e.y - e.h / 2 : e.y - e.h,
    base: e.t === 'flyer' ? e.y - e.h / 2 : e.y - e.h,
    ix: e.x, iy: e.t === 'flyer' ? e.y - e.h / 2 : e.y - e.h, dir: -1, vx: 0, vy: 0, onGround: true, dead: false, deadT: 0,
    spd: e.t === 'walker' ? 66 : 0, amp: e.amp || 0, speed: e.speed || 1,
    phase: i * 1.7, timer: 0.6 + Math.random() * 0.8, sx: 1, sy: 1,
  }));

  Game.level = L;
  Game.idx = idx;
  Game.player = makePlayer(def.start[0], def.start[1]);
  Game.spawnX = def.start[0]; Game.spawnY = def.start[1];
  Game.cam.x = clamp(def.start[0] - VISW * 0.35, 0, Math.max(0, L.width - VISW));
  Game.cam.y = Math.max(0, VH - VISH); Game.cam.shake = 0;
  Game.particles.length = 0; Game.floats.length = 0;
  Game.combo = 0; Game.comboT = -9;
  Game.run = { time: 0, deaths: 0, coins: 0, gems: 0 };
  Game.hintsShown = {};
  Game.flash = 0; Game.lightning = 0; Game.lightningT = rnd(4, 8);
  buildWeather(L);
  return L;
}

function buildWeather(L) {
  const w = L.theme.weather || 'motes';
  const list = [];
  const n = w === 'snow' ? 70 : w === 'rain' ? 90 : 46;
  for (let i = 0; i < n; i++) {
    list.push({
      x: Math.random() * VW, y: Math.random() * VH,
      r: w === 'snow' ? rnd(1.2, 3.2) : rnd(0.8, 2.2),
      v: w === 'rain' ? rnd(700, 1000) : w === 'embers' ? rnd(-26, -12) : rnd(10, 34),
      drift: rnd(-16, 16), ph: Math.random() * 6.28, a: rnd(0.15, 0.6),
    });
  }
  Game.weather = list;
}

const spawnPoint = (def) => ({ x: def.start[0], y: def.start[1] });

function makePlayer(x, y) {
  return {
    x: x - 13, y: y - 36, w: 26, h: 36,
    vx: 0, vy: 0, dir: 1,
    onGround: false, coyote: 0, jumpBuf: 0, jumps: 0, cut: false,
    dashT: 0, dashCd: 0, dashDir: 1, airDash: true, wallLock: 0,
    wallDir: 0, wallSliding: false, ride: null, dropT: 0,
    dead: false, deathT: 0, invuln: 0, won: false,
    runPhase: 0, sx: 1, sy: 1, squashT: 0, blink: rnd(1, 4), spinT: 0,
    scarf: Array.from({ length: 8 }, (_, i) => ({ x: x - 13, y: y - 32 + i * 3 })),
    trail: [], touchWall: 0, onGroundPrev: false, landVy: 0,
  };
}

const solidAt = (c, r) => {
  const L = Game.level;
  if (!L) return false;
  if (c < 0) return true;
  if (c >= L.cols) return true;
  if (r < 0) return false;
  if (r >= ROWS) return false;
  return L.grid[r * L.cols + c] === 1;
};

/* ============================================================ PARTICULES */
function part(o) {
  if (Game.particles.length > 520) return;
  Game.particles.push(Object.assign({
    x: 0, y: 0, vx: 0, vy: 0, life: 0.5, max: 0.5, size: 3, color: '#fff',
    grav: 0, drag: 1, type: 'dot', rot: 0, vr: 0,
  }, o));
}

function burst(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = o.angle == null ? Math.random() * Math.PI * 2 : o.angle + rnd(-o.spread || -0.5, o.spread || 0.5);
    const s = rnd(o.smin || 40, o.smax || 220);
    part({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: rnd(o.lmin || 0.3, o.lmax || 0.8), max: o.lmax || 0.8,
      size: rnd(o.sz1 || 2, o.sz2 || 4.5), color: o.color || '#fff',
      grav: o.grav == null ? 900 : o.grav, type: o.type || 'spark', drag: o.drag || 0.98,
    });
  }
}

function ring(x, y, color, size = 12, life = 0.35) {
  part({ x, y, life, max: life, size, color, type: 'ring' });
}

function floatText(x, y, text, color = '#fff', size = 14) {
  Game.floats.push({ x, y, text, color, size, life: 0.9, max: 0.9 });
}

/* ============================================================ CAMÉRA */
function updateCam(dt) {
  const L = Game.level; if (!L) return;
  const cam = Game.cam;
  const maxX = Math.max(0, L.width - VISW);
  const maxY = Math.max(0, VH - VISH);
  let tx = cam.x, ty = maxY;
  if (Game.screen === 'play' && Game.player) {
    const p = Game.player;
    const look = clamp(p.vx * 0.34, -150, 150);
    tx = clamp(p.x + p.w / 2 - VISW * 0.5 + look, 0, maxX);
    ty = clamp(p.y + p.h * 0.55 - VISH * 0.62, 0, maxY);
  } else if (Game.screen === 'menu' || Game.screen === 'levels') {
    tx = maxX * (0.5 - 0.5 * Math.cos(Game.time * 0.055));
  } else {
    tx = clamp((Game.player ? Game.player.x : L.width * 0.1) - VISW * 0.4, 0, maxX);
  }
  const k = Game.screen === 'play' ? Math.min(1, dt * 7.5) : Math.min(1, dt * 2.2);
  cam.x = lerp(cam.x, tx, k);
  cam.y = lerp(cam.y, ty, Math.min(1, dt * 5));
  cam.shake = Math.max(0, cam.shake - dt * 34);
}
function shake(a) { Game.cam.shake = Math.max(Game.cam.shake, a); }

/* ============================================================ JOUEUR */
function updatePlayer(dt) {
  const p = Game.player, L = Game.level;
  const inp = Input;

  p.onGroundPrev = p.onGround;
  p.invuln = Math.max(0, p.invuln - dt);
  p.wallLock = Math.max(0, p.wallLock - dt);
  p.dropT = Math.max(0, p.dropT - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.squashT = Math.max(0, p.squashT - dt);
  p.spinT = Math.max(0, p.spinT - dt);
  p.blink -= dt; if (p.blink < -0.12) p.blink = rnd(1.8, 5);

  // plateforme mobile : suivre le delta
  if (p.ride && p.ride.kind === 'mover') { p.x += p.ride.dx; p.y += p.ride.dy; }

  // ---- contact mural
  p.wallDir = 0;
  if (!p.onGround) {
    const rMid = Math.floor((p.y + p.h * 0.45) / T);
    if (solidAt(Math.floor((p.x - 3) / T), rMid)) p.wallDir = -1;
    else if (solidAt(Math.floor((p.x + p.w + 3) / T), rMid)) p.wallDir = 1;
  }
  const pushDir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  const wantWall = p.wallDir !== 0 && pushDir === p.wallDir && p.vy > -80;

  // ---- dash
  if (inp.dashEdge) {
    inp.dashEdge = false;
    const canDash = p.dashT <= 0 && p.dashCd <= 0 && (p.onGround || p.airDash);
    if (canDash) {
      p.dashT = PHYS.dashT; p.dashDir = pushDir || p.dir;
      p.vx = p.dashDir * PHYS.dashSpd; p.vy = 0;
      p.dashCd = PHYS.dashCd; p.airDash = false; p.wallLock = 0; p.cut = false;
      p.trail.length = 0;
      for (let i = 0; i < 7; i++) {
        part({ x: p.x + p.w / 2, y: p.y + rnd(4, p.h - 4), vx: -p.dashDir * rnd(60, 260), vy: rnd(-40, 40),
          life: rnd(0.16, 0.34), max: 0.34, size: rnd(2, 5), color: '#bfefff', type: 'spark', grav: 0 });
      }
      ring(p.x + p.w / 2, p.y + p.h / 2, '#9fe8ff', 14, 0.28);
      shake(5); Sound.dash();
      hint('dash');
    }
  }

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.dashDir * PHYS.dashSpd * (p.dashT > 0.03 ? 1 : 0.5);
    p.vy = 0;
    if (Math.random() < 0.6) {
      p.trail.push({ x: p.x, y: p.y, dir: p.dir, life: 0.22, sx: p.sx, sy: p.sy });
    }
    if (p.dashT <= 0) p.dashCd = PHYS.dashCd;
  } else if (p.wallLock <= 0) {
    // ---- déplacement horizontal
    let target = pushDir * PHYS.spd;
    if (pushDir !== 0) p.dir = pushDir;
    const accel = p.onGround
      ? (pushDir !== 0 ? PHYS.accG : PHYS.decG)
      : (pushDir !== 0 ? PHYS.accA : PHYS.decA);
    p.vx = approach(p.vx, target, accel * dt);
  }

  // ---- saut (buffer + coyote + mur + double)
  if (p.onGround) { p.coyote = PHYS.coyote; p.jumps = 0; p.airDash = true; }
  else p.coyote = Math.max(0, p.coyote - dt);
  if (inp.jumpEdge) { inp.jumpEdge = false; p.jumpBuf = PHYS.buffer; }
  p.jumpBuf = Math.max(0, p.jumpBuf - dt);

  if (p.jumpBuf > 0 && p.dashT <= 0) {
    if (p.onGround || p.coyote > 0) {
      p.vy = PHYS.jump; p.jumps = 1; p.cut = true; p.jumpBuf = 0;
      p.onGround = false; p.coyote = 0; p.ride = null;
      burst(p.x + p.w / 2, p.y + p.h, 6, { color: '#ffffff', angle: -Math.PI / 2, spread: 1.1, smin: 30, smax: 110, sz1: 1.5, sz2: 3, lmin: 0.15, lmax: 0.35, grav: 300 });
      Sound.jump();
    } else if (p.wallDir !== 0) {
      p.vy = PHYS.wallJumpY; p.vx = -p.wallDir * PHYS.wallJumpX;
      p.dir = -p.wallDir; p.wallLock = PHYS.wallLock; p.jumps = 1;
      p.cut = true; p.jumpBuf = 0; p.airDash = true; p.ride = null;
      burst(p.x + (p.wallDir > 0 ? p.w : 0), p.y + p.h / 2, 8,
        { color: '#dff9ff', angle: p.wallDir > 0 ? Math.PI : 0, spread: 0.9, smin: 40, smax: 170, sz1: 1.5, sz2: 3.5, lmin: 0.2, lmax: 0.4, grav: 200 });
      Sound.wallJump(); shake(3);
      hint('wall');
    } else if (p.jumps < 2) {
      p.vy = PHYS.jump2; p.jumps = 2; p.cut = true; p.jumpBuf = 0; p.ride = null;
      p.airDash = true; p.spinT = 0.45;
      ring(p.x + p.w / 2, p.y + p.h, '#ffe9a8', 13, 0.3);
      burst(p.x + p.w / 2, p.y + p.h, 9, { color: '#fff2c2', angle: Math.PI / 2, spread: 1.4, smin: 30, smax: 130, grav: 120, lmin: 0.2, lmax: 0.45 });
      Sound.doubleJump();
    }
  }
  // hauteur de saut variable
  if (p.cut && !inp.jumpHeld && p.vy < -310) { p.vy = -310; p.cut = false; }

  // ---- chute rapide
  if (inp.down && !p.onGround && p.dashT <= 0) p.vy += PHYS.g * 0.9 * dt;

  // ---- gravité / glissade murale
  p.wallSliding = false;
  if (p.dashT <= 0) {
    if (wantWall && p.vy > 0) {
      p.wallSliding = true;
      p.vy = Math.min(p.vy + PHYS.g * PHYS.wallGravity * dt, PHYS.wallSlide);
      if (Math.random() < 0.35) part({ x: p.x + (p.wallDir > 0 ? p.w : 0), y: p.y + rnd(4, p.h), vx: rnd(-10, 10), vy: rnd(-40, 10), life: 0.3, max: 0.3, size: rnd(1, 2.6), color: '#dff9ff', grav: 200, type: 'dot' });
    } else {
      p.vy = Math.min(p.vy + PHYS.g * (p.vy > 0 ? PHYS.fallMult : 1) * dt, PHYS.maxFall);
    }
  }

  // ---- collisions
  p.touchWall = 0;
  p.onGround = false;
  moveX(p, dt);
  moveY(p, dt);

  // atterrissage
  if (p.onGround && !p.onGroundPrev) {
    p.landVy = p.vy;
    p.squashT = 0.16;
    const hard = p.vy > 620;
    burst(p.x + p.w / 2, p.y + p.h, hard ? 10 : 5,
      { color: '#e8f6ff', angle: -Math.PI / 2, spread: 1.25, smin: 40, smax: hard ? 200 : 110, sz1: 1.5, sz2: 3.4, lmin: 0.18, lmax: 0.4, grav: 600 });
    Sound.land(hard);
    if (hard) shake(4);
  }
  if (p.onGround) { p.coyote = PHYS.coyote; p.jumps = 0; p.airDash = true; p.wallLock = 0; p.cut = false; }

  // animation
  const spd = Math.abs(p.vx);
  p.runPhase += dt * (6 + spd * 0.045);
  const targetSy = p.squashT > 0 ? 0.82 : p.dashT > 0 ? 0.9 : 1, targetSx = p.squashT > 0 ? 1.16 : p.dashT > 0 ? 1.1 : 1;
  p.sy = lerp(p.sy, targetSy, Math.min(1, dt * 18));
  p.sx = lerp(p.sx, targetSx, Math.min(1, dt * 18));
  if (!p.onGround) {
    const stretch = clamp(-p.vy / 1600, -0.12, 0.16);
    p.sy = lerp(p.sy, 1 + stretch, Math.min(1, dt * 10));
    p.sx = lerp(p.sx, 1 - stretch * 0.7, Math.min(1, dt * 10));
  }

  // écharpe
  {
    const cx = p.x + p.w / 2 - p.dir * 5, cy = p.y + 12;
    const s0 = p.scarf[0];
    s0.x = lerp(s0.x, cx, 0.55); s0.y = lerp(s0.y, cy, 0.55);
    for (let i = 1; i < p.scarf.length; i++) {
      const a = p.scarf[i - 1], b = p.scarf[i];
      const tx = a.x - p.dir * 4.2, ty = a.y + 3.1;
      b.x = lerp(b.x, tx, 0.32); b.y = lerp(b.y, ty + Math.sin(Game.time * 6 + i) * 0.5, 0.32);
      b.x += clamp(b.x - (cx - p.dir * 30), -14, 14) * 0.004;
    }
  }
  // traînées de dash
  for (let i = p.trail.length - 1; i >= 0; i--) {
    p.trail[i].life -= dt;
    if (p.trail[i].life <= 0) p.trail.splice(i, 1);
  }

  // ---- dangers
  if (p.y > 800) killPlayer('fall');
  const pb = { x: p.x + 5, y: p.y + 4, w: p.w - 10, h: p.h - 6 };
  for (const s of L.spikes) {
    if (overlap(pb, s)) { killPlayer('spikes'); return; }
  }
}

function moveX(p, dt) {
  if (p.vx === 0) return;
  p.x += p.vx * dt;
  const r0 = Math.floor((p.y + 3) / T), r1 = Math.floor((p.y + p.h - 3) / T);
  if (p.vx > 0) {
    const c = Math.floor((p.x + p.w) / T);
    for (let r = r0; r <= r1; r++) if (solidAt(c, r)) { p.x = c * T - p.w - 0.01; p.vx = 0; p.touchWall = 1; break; }
  } else {
    const c = Math.floor(p.x / T);
    for (let r = r0; r <= r1; r++) if (solidAt(c, r)) { p.x = (c + 1) * T + 0.01; p.vx = 0; p.touchWall = -1; break; }
  }
}

function moveY(p, dt) {
  const prevBottom = p.y + p.h;
  p.y += p.vy * dt;
  const c0 = Math.floor((p.x + 3) / T), c1 = Math.floor((p.x + p.w - 3) / T);
  if (p.vy >= 0) {
    const r = Math.floor((p.y + p.h) / T);
    for (let c = c0; c <= c1; c++) {
      if (solidAt(c, r)) { p.y = r * T - p.h; p.vy = 0; p.onGround = true; p.ride = null; break; }
    }
    if (!p.onGround && p.dropT <= 0) {
      const feet = p.y + p.h;
      const list = Game.level.plats.concat(
        Game.level.crumbles.filter(c => c.state !== 'gone'),
        Game.level.movers
      );
      for (const pl of list) {
        if (prevBottom <= pl.y + 5 && feet >= pl.y &&
            p.x + p.w > pl.x + 3 && p.x < pl.x + pl.w - 3) {
          p.y = pl.y - p.h; p.vy = 0; p.onGround = true; p.ride = pl;
          if (pl.kind === 'crumble' && pl.state === 'idle') { pl.state = 'shake'; pl.t = 0.45; }
          break;
        }
      }
    }
  } else {
    const r = Math.floor(p.y / T);
    for (let c = c0; c <= c1; c++) {
      if (solidAt(c, r)) { p.y = (r + 1) * T; p.vy = 0; p.cut = false; break; }
    }
  }
}

/* ============================================================ MORT / RESPAWN */
function killPlayer(reason) {
  const p = Game.player;
  if (!p || p.dead || p.won) return;
  // l'invulnérabilité temporaire ne protège jamais d'une chute ou des piques
  if (p.invuln > 0 && reason === 'enemy') return;
  p.dead = true; p.deathT = 0.8;
  Game.lastDeathX = p.x;
  Game.run.deaths++;
  Game.flash = 0.5; Game.flashColor = 'rgba(255,80,120,1)';
  shake(16);
  burst(p.x + p.w / 2, p.y + p.h / 2, 26, { color: '#ffdf6b', smin: 80, smax: 380, sz1: 2, sz2: 6, lmin: 0.3, lmax: 0.9, grav: 700 });
  burst(p.x + p.w / 2, p.y + p.h / 2, 14, { color: '#ff5d8f', smin: 60, smax: 300, sz1: 2, sz2: 5, lmin: 0.25, lmax: 0.7, grav: 500 });
  ring(p.x + p.w / 2, p.y + p.h / 2, '#ff8fb0', 18, 0.5);
  Sound.death();
  emit('death', { reason });
}

function respawn() {
  const p = Game.player;
  p.dead = false; p.deathT = 0;
  p.x = Game.spawnX - 13; p.y = Game.spawnY - 36;
  p.vx = 0; p.vy = 0; p.dir = 1; p.onGround = false; p.ride = null;
  p.dashT = 0; p.dashCd = 0; p.invuln = 0.9; p.jumps = 0; p.cut = false;
  p.wallLock = 0; p.airDash = true; p.trail.length = 0;
  p.scarf.forEach((s, i) => { s.x = p.x + 5; s.y = p.y + 12 + i * 3; });
  Game.cam.shake = 0;
  // remise en place des ennemis et plateformes
  for (const e of Game.level.enemies) {
    e.x = e.ix; e.y = e.iy; e.base = e.iy; e.dead = false; e.deadT = 0;
    e.dir = -1; e.vx = 0; e.vy = 0; e.onGround = true; e.timer = 0.7 + Math.random() * 0.7;
  }
  for (const c of Game.level.crumbles) { c.state = 'idle'; c.t = 0; }
  emit('respawn');
}

/* ============================================================ MISE À JOUR */
function updateMovers(dt) {
  for (const m of Game.level.movers) {
    const period = (2 * m.dist) / Math.max(1, m.speed);
    let ph = ((Game.time + m.phase * period) % period + period) % period / period;
    const k = ph < 0.5 ? ph * 2 : 2 - ph * 2;
    const nx = m.axis === 'x' ? m.x0 + m.dist * k : m.x0;
    const ny = m.axis === 'y' ? m.y0 + m.dist * k : m.y0;
    m.dx = nx - m.x; m.dy = ny - m.y;
    m.x = nx; m.y = ny;
  }
}

function updateCrumbles(dt) {
  const p = Game.player;
  for (const c of Game.level.crumbles) {
    if (c.state === 'shake') {
      c.t -= dt;
      if (c.t <= 0) {
        c.state = 'gone'; c.t = 2.2;
        burst(c.x + c.w / 2, c.y + 6, 10, { color: '#ffd9a0', angle: Math.PI / 2, spread: 1.2, smin: 40, smax: 160, sz1: 2, sz2: 5, grav: 900, lmin: 0.3, lmax: 0.7 });
        if (p && p.ride === c) { p.ride = null; p.onGround = false; }
        Sound.rumble();
      }
    } else if (c.state === 'gone') {
      c.t -= dt;
      if (c.t <= 0) { c.state = 'idle'; c.t = 0; }
    }
  }
}

function updateEnemies(dt) {
  const p = Game.player, L = Game.level;
  for (const e of L.enemies) {
    if (e.dead) { e.deadT -= dt; continue; }
    if (e.t === 'walker') {
      e.vy = Math.min(e.vy + PHYS.g * dt, 950);
      const aheadX = e.dir > 0 ? e.x + e.w + 3 : e.x - 3;
      const midRow = Math.floor((e.y + e.h * 0.5) / T);
      const footRow = Math.floor((e.y + e.h + 8) / T);
      const aheadCol = Math.floor(aheadX / T);
      let turn = solidAt(aheadCol, midRow) || !solidAt(aheadCol, footRow);
      if (!turn) for (const s of L.spikes) if (aheadX > s.x - 6 && aheadX < s.x + s.w + 6 && e.y + e.h > s.y - 4) { turn = true; break; }
      if (turn) e.dir *= -1;
      else e.x += e.dir * e.spd * dt;
      // chute / sol
      e.y += e.vy * dt;
      const cMid = Math.floor((e.x + e.w * 0.5) / T);
      const rFoot = Math.floor((e.y + e.h) / T);
      if (e.vy > 0 && solidAt(cMid, rFoot)) { e.y = rFoot * T - e.h; e.vy = 0; }
      // mur
      const cEdge = Math.floor((e.dir > 0 ? e.x + e.w + 1 : e.x - 1) / T);
      if (solidAt(cEdge, Math.floor((e.y + e.h * 0.5) / T))) e.dir *= -1;
    } else if (e.t === 'flyer') {
      e.phase += dt * e.speed;
      e.x = e.ix + Math.sin(e.phase * 2.1) * (e.amp || 0);
      e.y = e.base + Math.sin(e.phase * 3.3) * 16 - 8;
    } else if (e.t === 'hopper') {
      if (e.onGround) {
        e.timer -= dt;
        e.vx *= 0.86;
        e.x += e.vx * dt;
        if (e.timer <= 0) {
          e.timer = rnd(0.75, 1.25);
          let dx = 999, sameY = false;
          if (p && !p.dead) { dx = p.x - e.x; sameY = Math.abs(p.y - e.y) < 190; }
          if (Math.abs(dx) < 540 && sameY) { e.vx = sgn(dx || 1) * 220; e.dir = sgn(dx || 1); }
          else { e.vx = e.dir * 130; }
          e.vy = -640; e.onGround = false; e.sy = 0.7; e.sx = 1.25;
        }
      } else {
        e.vy = Math.min(e.vy + PHYS.g * dt, 950);
        e.x += e.vx * dt;
        const rMid = Math.floor((e.y + e.h * 0.55) / T);
        if (solidAt(Math.floor((e.dir > 0 ? e.x + e.w : e.x) / T), rMid)) e.vx *= -0.4;
        e.y += e.vy * dt;
        const rFoot = Math.floor((e.y + e.h) / T);
        if (e.vy > 0 && solidAt(Math.floor((e.x + e.w / 2) / T), rFoot)) {
          e.y = rFoot * T - e.h; e.vy = 0; e.onGround = true;
          burst(e.x + e.w / 2, e.y + e.h, 4, { color: '#c8ffe8', angle: -Math.PI / 2, spread: 1, smin: 20, smax: 80, sz1: 1, sz2: 2.5, grav: 500, lmin: 0.15, lmax: 0.3 });
        }
      }
      e.sx = lerp(e.sx, 1, Math.min(1, dt * 8)); e.sy = lerp(e.sy, 1, Math.min(1, dt * 8));
    }
  }
}

function updateInteractions() {
  const p = Game.player, L = Game.level;
  if (!p || p.dead) return;

  // pièces
  const px = p.x + p.w / 2, py = p.y + p.h / 2;
  for (const c of L.coins) {
    if (c.got) continue;
    const dx = c.x - px, dy = c.y - py;
    if ((dx * dx) / (30 * 30) + (dy * dy) / (46 * 46) < 1) {
      c.got = true; Game.run.coins++;
      Game.combo = (Game.time - Game.comboT < 1.35) ? Game.combo + 1 : 1;
      Game.comboT = Game.time;
      Sound.coin(Game.combo);
      part({ x: c.x, y: c.y, life: 0.3, max: 0.3, size: 10, color: '#ffd85c', type: 'ring' });
      burst(c.x, c.y, 6, { color: '#ffe9a0', smin: 30, smax: 130, sz1: 1.5, sz2: 3, grav: 300, lmin: 0.2, lmax: 0.45 });
      if (Game.combo >= 3) floatText(c.x, c.y - 10, '×' + Game.combo, '#ffd85c', 13);
      else floatText(c.x, c.y - 8, '+1', '#ffe9a0', 12);
    }
  }
  // gemmes
  for (const g of L.gems) {
    if (g.got) continue;
    const dx = g.x - px, dy = g.y - py;
    if ((dx * dx) / (36 * 36) + (dy * dy) / (52 * 52) < 1) {
      g.got = true; Game.run.gems++;
      Sound.gem();
      ring(g.x, g.y, '#9fe8ff', 16, 0.5);
      burst(g.x, g.y, 18, { color: '#bff4ff', smin: 60, smax: 260, sz1: 2, sz2: 5, grav: 260, lmin: 0.3, lmax: 0.8 });
      floatText(g.x, g.y - 14, 'GEMME !', '#9fe8ff', 15);
      shake(3);
    }
  }
  // ressorts
  for (const s of L.springs) {
    s.t = Math.max(0, s.t - 0.016);
    if (p.vy >= 0 && overlap(p, s)) {
      p.y = s.y - p.h; p.vy = PHYS.spring; p.cut = false; p.jumps = 1; p.airDash = true;
      p.ride = null; p.onGround = false; p.wallLock = 0;
      s.t = 0.32;
      Sound.spring(); shake(5);
      burst(s.x + s.w / 2, s.y, 12, { color: '#ffd9a0', angle: -Math.PI / 2, spread: 0.9, smin: 90, smax: 260, sz1: 2, sz2: 4, grav: 500, lmin: 0.2, lmax: 0.5 });
      hint('spring');
    }
  }
  // ennemis
  for (const e of L.enemies) {
    if (e.dead) continue;
    const eb = { x: e.x + 3, y: e.y + 3, w: e.w - 6, h: e.h - 4 };
    if (!overlap(p, eb)) continue;
    const fromAbove = p.vy > 40 && p.y + p.h - e.y < 26;
    if (fromAbove) {
      e.dead = true; e.deadT = 0.4;
      p.vy = PHYS.stompBounce; p.jumps = 1; p.airDash = true; p.squashT = 0.12;
      Sound.stomp(); shake(4);
      burst(e.x + e.w / 2, e.y + e.h / 2, 14, { color: e.t === 'flyer' ? '#ffb3f0' : '#ffd9a0', smin: 60, smax: 240, grav: 700, lmin: 0.2, lmax: 0.6 });
      floatText(e.x + e.w / 2, e.y - 6, '+5', '#ffd85c', 12);
    } else if (p.invuln <= 0 && p.dashT <= 0) {
      killPlayer('enemy');
    } else if (p.dashT > 0) {
      // le dash traverse les ennemis
    }
  }
  // checkpoint
  for (const c of L.checkpoints) {
    if (c.active) { c.t += 0.016; continue; }
    if (Math.abs(px - c.x) < 36 && Math.abs(py - (c.y - 40)) < 80) {
      c.active = true; c.t = 0;
      Game.spawnX = c.x; Game.spawnY = c.y;
      Sound.checkpoint();
      burst(c.x, c.y - 60, 16, { color: '#bff4ff', smin: 40, smax: 200, grav: 200, lmin: 0.3, lmax: 0.8 });
      ring(c.x, c.y - 40, '#bff4ff', 20, 0.6);
      floatText(c.x, c.y - 96, 'POINT DE CONTRÔLE', '#bff4ff', 13);
      emit('checkpoint');
    }
  }
  // ressort de plateforme : hint
  if (p.ride && p.ride.kind === 'mover') hint('mover');
  if (p.ride && p.ride.kind === 'crumble') hint('crumble');
  if (p.wallSliding) hint('wall');

  // but : grande zone (on ne peut pas la sauter par-dessus)
  const g = L.goal;
  const gb = { x: g.x - 54, y: g.y - 460, w: 108, h: 460 };
  if (overlap(p, gb)) completeLevel();
}

/* ============================================================ FIN DE NIVEAU */
function completeLevel() {
  if (Game.screen !== 'play') return;
  const p = Game.player, L = Game.level;
  p.won = true;
  Game.screen = 'complete';
  const totalCoins = L.coins.length, totalGems = L.gems.length;
  const stars = 1 + (Game.run.coins >= Math.ceil(totalCoins * 0.7) ? 1 : 0) + (Game.run.time <= L.def.par ? 1 : 0);
  Game.result = {
    idx: Game.idx, time: Game.run.time, coins: Game.run.coins, totalCoins,
    gems: Game.run.gems, totalGems, deaths: Game.run.deaths, stars,
    par: L.def.par, name: L.def.name,
  };
  Sound.win();
  shake(8);
  for (let i = 0; i < 40; i++) {
    part({
      x: L.goal[0] + rnd(-40, 40), y: L.goal[1] - rnd(60, 140),
      vx: rnd(-260, 260), vy: rnd(-520, -160), life: rnd(0.8, 1.6), max: 1.6,
      size: rnd(3, 7), color: ['#ffd85c', '#5ef0ff', '#ff5d8f', '#b8ff9a'][i % 4],
      grav: 620, drag: 0.99, type: 'square', rot: Math.random() * 6, vr: rnd(-8, 8),
    });
  }
  emit('complete', Game.result);
}

function hint(key) {
  if (Game.hintsShown[key]) return;
  Game.hintsShown[key] = true;
  emit('hint', { key });
}

/* ============================================================ BOUCLE */
function updateGame(dt) {
  const L = Game.level, p = Game.player;
  if (!L || !p) return;
  updateMovers(dt);
  updateCrumbles(dt);

  if (p.dead) {
    p.deathT -= dt;
    updateEnemies(dt);
    if (p.deathT <= 0) respawn();
    return;
  }
  if (p.won) { updateEnemies(dt); return; }

  Game.run.time += dt;
  updatePlayer(dt);

  if (!p.dead) {
    updateEnemies(dt);
    updateInteractions();
  }
  // éclairs du niveau 5
  if (L.theme.weather === 'storm') {
    Game.lightningT -= dt;
    if (Game.lightningT <= 0) {
      Game.lightningT = rnd(5, 11);
      Game.lightning = 1;
      Game.thunderT = rnd(0.15, 0.5);
      Sound.rumble();
    }
    if (Game.thunderT > 0) { Game.thunderT -= dt; if (Game.thunderT <= 0) shake(6); }
  }
}

function updateParticles(dt) {
  for (let i = Game.particles.length - 1; i >= 0; i--) {
    const q = Game.particles[i];
    q.life -= dt;
    if (q.life <= 0) { Game.particles.splice(i, 1); continue; }
    q.vy += q.grav * dt;
    q.vx *= Math.pow(q.drag, dt * 60); q.vy *= Math.pow(q.drag, dt * 60);
    q.x += q.vx * dt; q.y += q.vy * dt;
    if (q.type === 'square') q.rot += q.vr * dt;
  }
  for (let i = Game.floats.length - 1; i >= 0; i--) {
    const f = Game.floats[i];
    f.life -= dt; f.y -= 42 * dt;
    if (f.life <= 0) Game.floats.splice(i, 1);
  }
  if (Game.flash > 0) Game.flash = Math.max(0, Game.flash - dt * 2.2);
  Game.lightning = Math.max(0, Game.lightning - dt * 2.4);
}

function updateWeather(dt, active) {
  const w = Game.level ? Game.level.theme.weather || 'motes' : 'motes';
  for (const q of Game.weather) {
    q.ph += dt;
    if (w === 'rain') {
      q.y += q.v * dt; q.x += 90 * dt;
      if (q.y > VH) { q.y = -20; q.x = Math.random() * VW; }
      if (q.x > VW) q.x = -10;
    } else if (w === 'snow') {
      q.y += q.v * dt; q.x += (Math.sin(q.ph * 1.4) * 22 + q.drift) * dt;
      if (q.y > VH) { q.y = -8; q.x = Math.random() * VW; }
      if (q.x > VW) q.x = 0; if (q.x < 0) q.x = VW;
    } else if (w === 'embers') {
      q.y += q.v * dt; q.x += Math.sin(q.ph * 2) * 16 * dt;
      if (q.y < -10) { q.y = VH + 10; q.x = Math.random() * VW; }
    } else {
      q.x += q.drift * dt; q.y += Math.sin(q.ph * 0.7) * 8 * dt;
      if (q.x > VW + 10) q.x = -10; if (q.x < -10) q.x = VW + 10;
    }
  }
}

const Engine = {
  loadLevel, beginRun, tick, respawn,
  get game() { return Game; },
};
window.Engine = Engine;
window.Game = Game;
window.Input = Input;
window.LEVELS = LEVELS;

function beginRun() {
  const idx = Game.idx;
  loadLevel(idx);
  Game.screen = 'play';
  Game.run = { time: 0, deaths: 0, coins: 0, gems: 0 };
  Game.result = null;
  Game.player.invuln = 0.4;
  Game.events.length = 0;
  Input.reset();
  Sound.setMood(idx);
}

function tick(dt) {
  Game.time += dt;
  const L = Game.level;
  if (Game.screen === 'play') updateGame(dt);
  else if (L) {
    // ambiance : ennemis qui respirent, plateformes mobiles, caméra lente
    updateMovers(dt);
  }
  updateParticles(dt);
  updateWeather(dt);
  updateCam(dt);
  if (Game.lightning <= 0) Game.flash = Math.max(0, Game.flash - dt * 1.6);
}
