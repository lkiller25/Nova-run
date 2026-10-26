/* ============================================================
   NOVA RUN — rendu canvas
   ============================================================ */
const Render = (function () {
  let cv, ctx, dpr = 1;
  let staticLayer = null, staticIdx = -1;
  let vignette = null;
  let bg = null, bgIdx = -1;
  let debug = false;
  let quality = 1;          // 1 = pleine, 0.75 / 0.55 = dégradé
  let dprCap = 2;
  const SPAN = VW + 500;

  const R = Math.random;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function init() {
    cv = document.getElementById('cv');
    ctx = cv.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    const cap = Math.min(dprCap, touch ? 1.5 : 2) * (quality < 1 ? quality : 1);
    dpr = Math.max(0.75, Math.min(window.devicePixelRatio || 1, cap));
    cv.width = Math.round(VW * dpr);
    cv.height = Math.round(VH * dpr);
    vignette = null;
    if (bg) bgIdx = -1;         // les calques doivent être reconstruits
    staticIdx = -1;
  }

  function setQuality(q) {
    if (q === quality) return;
    quality = q;
    resize();
  }

  const rr = (x, y, w, h, r) => {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  /* ========================================================== DÉCOR DE FOND */
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w); c.height = Math.ceil(h);
    return c;
  }

  function buildBg(L) {
    const th = L.theme;
    const rng = mulberry32(1337 + L.idx * 91);
    const layerH = Math.round(VH * 0.62);
    const layerY = VH - layerH;

    // ciel (dégradé) pré-rendu
    const skyC = makeCanvas(VW, VH);
    const sg = skyC.getContext('2d');
    const g = sg.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, th.sky[0]); g.addColorStop(0.42, th.sky[1]);
    g.addColorStop(0.74, th.sky[2]); g.addColorStop(1, th.sky[3]);
    sg.fillStyle = g; sg.fillRect(0, 0, VW, VH);

    // astre + halo
    const rad = L.idx === 1 ? 70 : 92;
    const sunSize = rad * 8.4;
    const sunC = makeCanvas(sunSize, sunSize);
    const uc = sunC.getContext('2d');
    const halo = uc.createRadialGradient(sunSize / 2, sunSize / 2, 0, sunSize / 2, sunSize / 2, sunSize / 2);
    halo.addColorStop(0, hexA(th.sun, 0.95));
    halo.addColorStop(0.16, hexA(th.sun, 0.5));
    halo.addColorStop(0.45, hexA(th.ambient, 0.16));
    halo.addColorStop(1, hexA(th.ambient, 0));
    uc.fillStyle = halo; uc.fillRect(0, 0, sunSize, sunSize);
    uc.fillStyle = th.sun;
    uc.beginPath(); uc.arc(sunSize / 2, sunSize / 2, rad * 0.62, 0, 6.283); uc.fill();
    if (L.idx === 3) {
      uc.fillStyle = hexA(th.sky[0], 0.85);
      uc.beginPath(); uc.arc(sunSize / 2 + rad * 0.28, sunSize / 2 - rad * 0.18, rad * 0.56, 0, 6.283); uc.fill();
    }

    // crêtes montagneuses
    const P = SPAN;   // période de répétition des calques
    const farPts = periodicRidge(P, 40, VH * 0.62, VH * 0.2, [[3, rng() * 6.28, 0.55], [7, rng() * 6.28, 0.3], [13, rng() * 6.28, 0.15]]);
    const midPts = periodicRidge(P, 40, VH * 0.74, VH * 0.15, [[2, rng() * 6.28, 0.5], [5, rng() * 6.28, 0.32], [11, rng() * 6.28, 0.18]]);
    const nearPts = periodicRidge(P, 40, VH * 0.86, VH * 0.09, [[4, rng() * 6.28, 0.5], [9, rng() * 6.28, 0.3], [17, rng() * 6.28, 0.2]]);
    const deco = Array.from({ length: 24 }, () => {
      const w = 26 + rng() * 70;
      return { x: 6 + rng() * (P - w - 12), w, h: 90 + rng() * 260, k: rng() };
    });

    const farC = bakeRidge(farPts, th.far, layerH);
    const midC = bakeRidge(midPts, th.mid, layerH);
    const nearC = bakeRidge(nearPts, th.near, layerH);
    const skylineC = bakeSkyline(L, deco, layerH);
    const fogC = makeCanvas(VW, VH);
    {
      const fg = fogC.getContext('2d');
      const fog = fg.createLinearGradient(0, VH * 0.5, 0, VH);
      fog.addColorStop(0, hexA(th.ambient, 0));
      fog.addColorStop(0.55, hexA(th.ambient, 0.1));
      fog.addColorStop(1, hexA(th.ambient, 0.02));
      fg.fillStyle = fog; fg.fillRect(0, VH * 0.5, VW, VH * 0.5);
    }

    bg = {
      th, skyC, sunC, sunSize, rad,
      farC, midC, nearC, skylineC, fogC, layerY, layerH,
      stars: Array.from({ length: 80 }, () => ({
        x: rng() * VW, y: rng() * VH * 0.72, r: rng() * 1.6 + 0.4, p: rng() * 6.28, s: 0.4 + rng() * 1.4,
      })),
    };
    bgIdx = L.idx;
  }

  // crête lisse et strictement périodique sur [0, period]
  function periodicRidge(period, step, base, amp, harmonics) {
    const pts = [];
    for (let x = 0; x <= period; x += step) {
      let v = 0;
      for (const [k, ph, w] of harmonics) v += w * Math.sin((2 * Math.PI * k * x) / period + ph);
      pts.push({ x, y: base - amp * (0.5 + 0.5 * v) });
    }
    return pts;
  }

  function bakeRidge(pts, color, h) {
    const c = makeCanvas(SPAN, h);
    const g = c.getContext('2d');
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, h + 4);
    for (const p of pts) g.lineTo(p.x, p.y - (VH - h));
    g.lineTo(SPAN, h + 4);
    g.closePath(); g.fill();
    return c;
  }

  function bakeSkyline(L, deco, h) {
    const th = L.theme;
    const c = makeCanvas(SPAN, h);
    const g = c.getContext('2d');
    const base = VH * 0.86 - (VH - h);
    // style piloté par le thème, avec repli sur les anciens repères par index
    const style = th.skyline || (L.idx === 1 ? 'trees' : L.idx === 2 ? 'mesa' : L.idx === 3 ? 'peaks' : 'city');
    for (const d of deco) {
      const x = d.x;
      if (style === 'sea') {
        // bateaux pirates : coque, mât, voiles
        const hh = d.h * 0.72;
        g.fillStyle = hexA(th.mid, 0.9);
        g.beginPath();
        g.moveTo(x, base); g.lineTo(x + 6, base - hh * 0.42);
        g.lineTo(x + d.w - 6, base - hh * 0.42); g.lineTo(x + d.w, base);
        g.closePath(); g.fill();
        const mastX = x + d.w / 2;
        g.strokeStyle = hexA(th.mid, 0.95); g.lineWidth = 2.4;
        g.beginPath(); g.moveTo(mastX, base - hh * 0.42); g.lineTo(mastX, base - hh); g.stroke();
        g.fillStyle = hexA(th.accent, 0.22);
        g.beginPath();
        g.moveTo(mastX + 1.5, base - hh + 6); g.lineTo(mastX + d.w * 0.34, base - hh * 0.5);
        g.lineTo(mastX + 1.5, base - hh * 0.48); g.closePath(); g.fill();
        g.beginPath();
        g.moveTo(mastX - 1.5, base - hh + 10); g.lineTo(mastX - d.w * 0.3, base - hh * 0.52);
        g.lineTo(mastX - 1.5, base - hh * 0.5); g.closePath(); g.fill();
        g.strokeStyle = hexA(th.ambient, 0.4); g.lineWidth = 2;
        g.beginPath(); g.moveTo(x - 6, base - 2);
        g.quadraticCurveTo(x + d.w * 0.25, base - 7, x + d.w * 0.5, base - 2);
        g.quadraticCurveTo(x + d.w * 0.75, base + 3, x + d.w + 6, base - 2); g.stroke();
      } else if (style === 'castle') {
        // tours de château avec toits pointus et calots de neige
        const hh = d.h * 0.85;
        g.fillStyle = hexA(th.mid, 0.92);
        g.fillRect(x + d.w * 0.2, base - hh * 0.6, d.w * 0.6, hh * 0.6);
        g.beginPath();
        g.moveTo(x + d.w * 0.12, base - hh * 0.6);
        g.lineTo(x + d.w * 0.5, base - hh);
        g.lineTo(x + d.w * 0.88, base - hh * 0.6);
        g.closePath(); g.fill();
        g.fillStyle = hexA('#ffffff', 0.5);
        g.beginPath();
        g.moveTo(x + d.w * 0.3, base - hh * 0.72);
        g.lineTo(x + d.w * 0.5, base - hh);
        g.lineTo(x + d.w * 0.7, base - hh * 0.72);
        g.closePath(); g.fill();
        for (let i = 0; i < 3; i++) {
          g.fillStyle = hexA(th.accent, 0.4 + 0.15 * Math.sin(d.k * 6 + i));
          g.fillRect(x + d.w * 0.42, base - hh * (0.52 - i * 0.16), d.w * 0.16, 4.5);
        }
      } else if (style === 'torii') {
        // portails torii en silhouette
        const hh = d.h * 0.8;
        g.fillStyle = hexA(th.mid, 0.92);
        const postW = Math.max(3, d.w * 0.09);
        g.fillRect(x + d.w * 0.18, base - hh, postW, hh);
        g.fillRect(x + d.w * 0.72, base - hh, postW, hh);
        g.fillStyle = hexA(th.accent2, 0.5);
        g.fillRect(x + d.w * 0.08, base - hh, d.w * 0.84, 5);
        g.fillRect(x + d.w * 0.02, base - hh - 7, d.w * 0.96, 5);
        g.fillStyle = hexA(th.mid, 0.9);
        g.fillRect(x + d.w * 0.3, base - hh * 0.55, d.w * 0.4, 4);
      } else if (style === 'trees') {
        const hh = d.h * 0.8;
        g.fillStyle = hexA(th.mid, 0.85);
        g.fillRect(x + d.w / 2 - 4, base - hh * 0.55, 8, hh * 0.55);
        const rg = g.createRadialGradient(x + d.w / 2, base - hh * 0.6, 4, x + d.w / 2, base - hh * 0.6, d.w * 0.9);
        rg.addColorStop(0, hexA(th.accent, 0.3)); rg.addColorStop(1, hexA(th.accent, 0));
        g.fillStyle = rg;
        g.beginPath(); g.arc(x + d.w / 2, base - hh * 0.62, d.w * 0.9, 0, 6.283); g.fill();
        g.fillStyle = hexA(th.mid, 0.95);
        g.beginPath(); g.arc(x + d.w / 2, base - hh * 0.6, d.w * 0.42, 0, 6.283); g.fill();
      } else if (style === 'mesa') {
        g.fillStyle = hexA(th.mid, 0.85);
        g.beginPath();
        g.moveTo(x, base); g.lineTo(x + d.w * 0.18, base - d.h * 0.7);
        g.lineTo(x + d.w * 0.82, base - d.h * 0.7); g.lineTo(x + d.w, base);
        g.closePath(); g.fill();
        g.fillStyle = hexA(th.accent, 0.12);
        g.fillRect(x + d.w * 0.18, base - d.h * 0.7, d.w * 0.64, 3);
      } else if (style === 'peaks') {
        g.beginPath();
        g.moveTo(x, base); g.lineTo(x + d.w * 0.5, base - d.h);
        g.lineTo(x + d.w, base); g.closePath();
        g.fillStyle = hexA(th.mid, 0.9); g.fill();
        g.strokeStyle = hexA(th.accent, 0.28); g.lineWidth = 1.5; g.stroke();
      } else {
        const w = d.w * 0.62, hh = d.h;
        const bx = x + d.w * 0.19, by = base - hh;
        g.fillStyle = hexA(th.mid, 0.92);
        g.fillRect(bx, by, w, hh);
        const lg = g.createLinearGradient(bx, by, bx + w, by);
        lg.addColorStop(0, hexA(th.accent, 0.35)); lg.addColorStop(1, hexA(th.accent2, 0.12));
        g.fillStyle = lg; g.fillRect(bx, by, w, 2.5);
        for (let i = 0; i < Math.floor(hh / 26); i++) {
          if ((i * 7 + Math.floor(d.x)) % 3 === 0) continue;
          g.fillStyle = hexA(th.accent, 0.16 + 0.1 * Math.sin(i + d.k * 8));
          g.fillRect(bx + 5 + (i % 2) * (w - 14), by + 12 + i * 24, 4, 7);
        }
      }
    }
    return c;
  }

  function drawSky(L, camX, camY) {
    const th = L.theme;
    if (!bg || bgIdx !== L.idx) buildBg(L);

    ctx.drawImage(bg.skyC, 0, 0);

    // étoiles
    if (th.star) {
      ctx.fillStyle = '#ffffff';
      for (const s of bg.stars) {
        const tw = 0.45 + 0.55 * Math.abs(Math.sin(Game.time * s.s + s.p));
        ctx.globalAlpha = tw * 0.9;
        const x = ((s.x - camX * 0.02) % VW + VW) % VW;
        ctx.beginPath(); ctx.arc(x, s.y, s.r, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // astre
    const sunX = VW * 0.76 - (camX * 0.035) % (VW * 1.6);
    const sunY = VH * (L.idx === 2 ? 0.34 : 0.26) - (camY || 0) * 0.12;
    ctx.drawImage(bg.sunC, sunX - bg.sunSize / 2, sunY - bg.sunSize / 2);

    // crêtes + skyline, avec parallaxe
    blitLayer(bg.farC, 0.1, camX);
    blitLayer(bg.midC, 0.22, camX);
    drawSkyline(L, camX, 0.4);
    blitLayer(bg.nearC, 0.5, camX);

    ctx.drawImage(bg.fogC, 0, 0);
  }

  function blitLayer(canvas, k, camX) {
    const y = VH - canvas.height;
    const w = canvas.width;
    let off = -((camX * k) % w);
    if (off > 0) off -= w;
    ctx.drawImage(canvas, off, y);
    ctx.drawImage(canvas, off + w, y);
  }

  function drawSkyline(L, camX, k) {
    if (!bg || !bg.skylineC) return;
    blitLayer(bg.skylineC, k, camX);
  }

  /* ========================================================== COUCHE STATIQUE */
  function buildStatic(L) {
    const th = L.theme;
    const c = document.createElement('canvas');
    c.width = L.width; c.height = VH;
    const g = c.getContext('2d');
    const old = ctx;
    ctx = g;

    const def = L.def;
    def.solids.forEach(([x, y, w, h]) => drawSolid(x, y, w, h, th, 'sol'));
    L.plats.forEach(p => drawSolid(p.x, p.y, p.w, 12, th, 'plat'));
    L.spikes.forEach(s => drawSpikes(s, th));

    // vase / éboulis décoratif au fond des fosses
    ctx.globalAlpha = 1;
    ctx = old;
    staticLayer = c; staticIdx = L.idx;
  }

  function drawSolid(x, y, w, h, th, kind) {
    if (kind === 'plat') {
      // dalle flottante
      const g = ctx.createLinearGradient(0, y, 0, y + 14);
      g.addColorStop(0, adjust(th.ground, 22));
      g.addColorStop(1, adjust(th.ground, -6));
      ctx.fillStyle = g;
      rr(x, y, w, 13, 5); ctx.fill();
      ctx.fillStyle = hexA(th.groundTop, 0.95);
      ctx.fillRect(x + 2, y, w - 4, 3);
      // chevrons dessous
      ctx.strokeStyle = hexA(th.accent, 0.22);
      ctx.lineWidth = 2;
      for (let i = 8; i < w - 8; i += 26) {
        ctx.beginPath();
        ctx.moveTo(x + i, y + 20); ctx.lineTo(x + i + 7, y + 27); ctx.lineTo(x + i + 14, y + 20);
        ctx.stroke();
      }
      // bords lumineux
      ctx.strokeStyle = hexA(th.accent, 0.5); ctx.lineWidth = 1.5;
      rr(x + 0.75, y + 0.75, w - 1.5, 11.5, 5); ctx.stroke();
      return;
    }
    // corps
    const g = ctx.createLinearGradient(0, y, 0, y + Math.min(h, 220));
    g.addColorStop(0, adjust(th.ground, 10));
    g.addColorStop(0.35, th.ground);
    g.addColorStop(1, adjust(th.ground, -14));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);

    // motif intérieur : dalles + hachures
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = hexA(th.accent, 0.11);
    ctx.lineWidth = 1;
    for (let gy = y + 40; gy < y + h; gy += 40) {
      ctx.beginPath(); ctx.moveTo(x, gy + 0.5); ctx.lineTo(x + w, gy + 0.5); ctx.stroke();
    }
    for (let gx = Math.ceil(x / 40) * 40; gx < x + w; gx += 40) {
      ctx.beginPath(); ctx.moveTo(gx + 0.5, y); ctx.lineTo(gx + 0.5, y + h); ctx.stroke();
    }
    ctx.strokeStyle = hexA(th.accent2, 0.07);
    for (let i = -h; i < w; i += 34) {
      ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); ctx.stroke();
    }
    // bandeau de surface
    const cap = ctx.createLinearGradient(0, y, 0, y + 18);
    cap.addColorStop(0, hexA(th.accent, 0.30));
    cap.addColorStop(1, hexA(th.accent, 0));
    ctx.fillStyle = cap;
    ctx.fillRect(x, y, w, 18);
    ctx.fillStyle = hexA(th.glow, 0.10);
    for (let gx = x + 20; gx < x + w - 20; gx += 40) ctx.fillRect(gx, y + 3, 26, 1.5);
    ctx.restore();

    // arête supérieure lumineuse
    const glow = ctx.createLinearGradient(0, y - 34, 0, y + 10);
    glow.addColorStop(0, hexA(th.groundTop, 0));
    glow.addColorStop(0.72, hexA(th.groundTop, 0.22));
    glow.addColorStop(1, hexA(th.groundTop, 0.55));
    ctx.fillStyle = glow;
    ctx.fillRect(x, y - 34, w, 46);
    ctx.fillStyle = th.groundTop;
    ctx.fillRect(x, y - 2, w, 4);
    ctx.fillStyle = hexA('#ffffff', 0.55);
    ctx.fillRect(x, y - 2, w, 1.2);

    // arêtes latérales
    ctx.fillStyle = hexA(th.accent, 0.25);
    ctx.fillRect(x, y, 2, h);
    ctx.fillRect(x + w - 2, y, 2, h);

    // marquage de bord de falaise (diagonales)
    const edge = 30;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y - 2, edge, 16); ctx.clip();
    ctx.strokeStyle = hexA(th.accent2, 0.55); ctx.lineWidth = 3;
    for (let i = -16; i < edge + 16; i += 11) {
      ctx.beginPath(); ctx.moveTo(x + i, y + 18); ctx.lineTo(x + i + 14, y - 4); ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.rect(x + w - edge, y - 2, edge, 16); ctx.clip();
    ctx.strokeStyle = hexA(th.accent2, 0.55); ctx.lineWidth = 3;
    for (let i = -16; i < edge + 16; i += 11) {
      ctx.beginPath(); ctx.moveTo(x + w - edge + i, y + 18); ctx.lineTo(x + w - edge + i + 14, y - 4); ctx.stroke();
    }
    ctx.restore();

    // petits pixels lumineux
    const rng = mulberry32(Math.abs(Math.round(x + y)) + 7);
    for (let i = 0; i < Math.min(26, (w * h) / 9000); i++) {
      const px = x + rng() * w, py = y + 14 + rng() * Math.min(h - 16, 120);
      ctx.fillStyle = hexA(i % 3 ? th.accent : th.accent2, 0.22);
      ctx.fillRect(px, py, 2, 2);
    }
  }

  function drawSpikes(s, th) {
    const n = Math.max(1, Math.round(s.w / 20));
    const step = s.w / n;
    for (let i = 0; i < n; i++) {
      const x0 = s.x + i * step;
      const hue = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
      hue.addColorStop(0, '#ffffff');
      hue.addColorStop(0.25, th.accent2);
      hue.addColorStop(1, hexA(th.accent2, 0.35));
      ctx.fillStyle = hue;
      ctx.beginPath();
      ctx.moveTo(x0 + 1, s.y + s.h);
      ctx.lineTo(x0 + step / 2, s.y);
      ctx.lineTo(x0 + step - 1, s.y + s.h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = hexA('#ffffff', 0.5); ctx.lineWidth = 1.2; ctx.stroke();
    }
    ctx.fillStyle = hexA(th.accent2, 0.5);
    ctx.fillRect(s.x, s.y + s.h - 3, s.w, 3);
  }

  /* ========================================================== ENTRÉES */
  function draw() {
    const L = Game.level;
    if (!L) return;
    if (staticIdx !== L.idx) buildStatic(L);
    if (!bg || bgIdx !== L.idx) buildBg(L);
    if (bg.stars && bg.stars.length && quality < 0.7) bg.stars.length = 40;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, VW, VH);

    const cam = Game.cam;
    const shx = cam.shake ? (R() - 0.5) * cam.shake * 1.6 : 0;
    const shy = cam.shake ? (R() - 0.5) * cam.shake * 1.2 : 0;
    const camX = cam.x + shx;
    const camY = cam.y + shy;

    drawSky(L, camX, camY);
    drawWeatherBack(L, camX);

    ctx.save();
    ctx.setTransform(dpr * ZOOM, 0, 0, dpr * ZOOM, -camX * ZOOM * dpr, -camY * ZOOM * dpr);
    drawStatic(camX);
    ctx.restore();

    // brume des gouffres (espace écran) : donne de la profondeur sous le sol
    {
      const th2 = L.theme;
      const depth = ctx.createLinearGradient(0, VH * 0.52, 0, VH);
      depth.addColorStop(0, hexA(th2.sky[0], 0));
      depth.addColorStop(0.55, hexA(th2.sky[1], 0.42));
      depth.addColorStop(1, hexA(th2.sky[0], 0.86));
      ctx.fillStyle = depth;
      ctx.fillRect(0, VH * 0.52, VW, VH * 0.48);
      // volutes lumineuses au fond
      for (let i = 0; i < 3; i++) {
        const yy = VH * (0.72 + i * 0.1);
        const off = ((camX * (0.06 + i * 0.03)) % (VW * 1.4));
        const grad = ctx.createRadialGradient(VW * 0.5 - off + i * 300, yy, 10, VW * 0.5 - off + i * 300, yy, 420);
        grad.addColorStop(0, hexA(th2.ambient, 0.07));
        grad.addColorStop(1, hexA(th2.ambient, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(0, yy - 420, VW, 840);
      }
    }
    ctx.save();
    ctx.setTransform(dpr * ZOOM, 0, 0, dpr * ZOOM, -camX * ZOOM * dpr, -camY * ZOOM * dpr);
    drawSprings(camX);
    drawCrumbles(camX);
    drawMovers(camX);
    drawCheckpoints(camX);
    drawGoal(camX);
    drawCoins(camX);
    drawGems(camX);
    drawEnemies(camX);
    drawPlayer();
    drawParticles(camX);
    drawFloats(camX);
    ctx.restore();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWeatherFront(L);
    drawVignette();
    drawFlash();

    if (debug) drawDebug();
  }

  function drawStatic(camX) {
    const sx = Math.max(0, Math.floor(camX));
    const w = Math.min(VISW + 4, staticLayer.width - sx);
    if (w > 0) ctx.drawImage(staticLayer, sx, 0, w, VH, sx, 0, w, VH);
  }

  const onScreen = (x, camX, m = 120) => x > camX - m && x < camX + VISW + m;

  /* ========================================================== PIÈCES / GEMMES */
  function drawCoins(camX) {
    const t = Game.time;
    for (const c of Game.level.coins) {
      if (c.got || !onScreen(c.x, camX)) continue;
      const bob = Math.sin(t * 2.4 + c.phase) * 3;
      const sc = Math.abs(Math.cos(t * 2.6 + c.phase));
      ctx.save();
      ctx.translate(c.x, c.y + bob);
      ctx.scale(0.35 + sc * 0.65, 1);
      ctx.shadowColor = 'rgba(255,206,74,.85)'; ctx.shadowBlur = 14;
      const g = ctx.createRadialGradient(-3, -4, 1, 0, 0, 10);
      g.addColorStop(0, '#fffbe0'); g.addColorStop(0.5, '#ffd85c'); g.addColorStop(1, '#e09b1e');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, 6.283); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath(); ctx.arc(-2.6, -3, 2.4, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(150,90,10,.5)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, 0, 5.4, 0, 6.283); ctx.stroke();
      ctx.restore();
    }
  }

  function drawGems(camX) {
    const t = Game.time;
    for (const g0 of Game.level.gems) {
      if (g0.got || !onScreen(g0.x, camX)) continue;
      const p = 1 + Math.sin(t * 3 + g0.phase) * 0.08;
      ctx.save();
      ctx.translate(g0.x, g0.y + Math.sin(t * 2 + g0.phase) * 4);
      ctx.rotate(Math.sin(t * 0.8) * 0.15);
      ctx.scale(p, p);
      ctx.shadowColor = 'rgba(120,230,255,.9)'; ctx.shadowBlur = 20;
      const g = ctx.createLinearGradient(-10, -12, 10, 12);
      g.addColorStop(0, '#f2ffff'); g.addColorStop(0.4, '#68d7ff'); g.addColorStop(1, '#9a6bff');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -13); ctx.lineTo(10, -2); ctx.lineTo(0, 13); ctx.lineTo(-10, -2);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(4, -2); ctx.lineTo(0, 4); ctx.lineTo(-4, -2); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  /* ========================================================== RESSORTS */
  function drawSprings(camX) {
    for (const s of Game.level.springs) {
      if (!onScreen(s.x, camX)) continue;
      const comp = s.t > 0 ? Math.min(1, s.t / 0.32) : 0;
      const h = 14 * (1 - comp * 0.6);
      const y = s.y + s.h - h;
      ctx.save();
      // socle
      ctx.fillStyle = '#241a33';
      rr(s.x + 2, s.y + s.h - 5, s.w - 4, 5, 2); ctx.fill();
      // ressort
      ctx.strokeStyle = '#ffd9a0'; ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(255,210,140,.9)'; ctx.shadowBlur = 12;
      ctx.beginPath();
      const coils = 3;
      ctx.moveTo(s.x + 4, s.y + s.h - 4);
      for (let i = 1; i <= coils * 2; i++) {
        const yy = s.y + s.h - 4 - (h * i) / (coils * 2);
        ctx.lineTo(i % 2 ? s.x + s.w - 4 : s.x + 4, yy);
      }
      ctx.lineTo(s.x + s.w - 4, y);
      ctx.stroke();
      // plateau
      ctx.fillStyle = '#ffd9a0';
      rr(s.x, y - 4, s.w, 6, 3); ctx.fill();
      ctx.restore();
    }
  }

  /* ========================================================== FRIABLES / MOBILES */
  function drawCrumbles(camX) {
    const th = Game.level.theme;
    for (const c of Game.level.crumbles) {
      if (!onScreen(c.x, camX)) continue;
      if (c.state === 'gone') {
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.setLineDash([5, 6]);
        ctx.strokeStyle = th.accent; ctx.lineWidth = 1.5;
        ctx.strokeRect(c.x + 2, c.y + 2, c.w - 4, 8);
        ctx.restore();
        continue;
      }
      const jx = c.state === 'shake' ? (Math.random() - 0.5) * 4 : 0;
      const jy = c.state === 'shake' ? (Math.random() - 0.5) * 2 : 0;
      const x = c.x + jx, y = c.y + jy;
      ctx.save();
      const g = ctx.createLinearGradient(0, y, 0, y + 13);
      g.addColorStop(0, '#4a3a56'); g.addColorStop(1, '#2a1f33');
      ctx.fillStyle = g;
      rr(x, y, c.w, 12, 4); ctx.fill();
      ctx.fillStyle = c.state === 'shake' ? '#ffb0c0' : hexA(th.glow, 0.85);
      ctx.fillRect(x + 2, y, c.w - 4, 3);
      // fissures
      ctx.strokeStyle = 'rgba(255,120,150,.65)'; ctx.lineWidth = 1.4;
      let sx = x + 10;
      ctx.beginPath(); ctx.moveTo(sx, y + 3);
      for (let i = 0; i < 3; i++) { sx += 9; ctx.lineTo(sx, y + 3 + (i % 2 ? 6 : 1)); }
      ctx.stroke();
      ctx.restore();
      if (c.state === 'shake' && Math.random() < 0.4) {
        part({ x: c.x + R() * c.w, y: c.y + 10, vx: rnd(-20, 20), vy: rnd(20, 70), life: 0.4, max: 0.4, size: rnd(1.5, 3), color: '#ffc9a0', grav: 500, type: 'dot' });
      }
    }
  }

  function drawMovers(camX) {
    const th = Game.level.theme;
    for (const m of Game.level.movers) {
      if (!onScreen(m.x, camX)) continue;
      ctx.save();
      // halo
      const gl = ctx.createRadialGradient(m.x + m.w / 2, m.y + 8, 2, m.x + m.w / 2, m.y + 8, m.w * 0.9);
      gl.addColorStop(0, hexA(th.accent, 0.22)); gl.addColorStop(1, hexA(th.accent, 0));
      ctx.fillStyle = gl;
      ctx.fillRect(m.x - m.w * 0.6, m.y - 30, m.w * 2.2, 70);
      const g = ctx.createLinearGradient(0, m.y, 0, m.y + 14);
      g.addColorStop(0, adjust(th.accent, -30)); g.addColorStop(1, '#100c1c');
      ctx.fillStyle = g;
      rr(m.x, m.y, m.w, 13, 5); ctx.fill();
      ctx.fillStyle = th.glow;
      ctx.fillRect(m.x + 2, m.y, m.w - 4, 3);
      ctx.strokeStyle = hexA(th.accent, 0.8); ctx.lineWidth = 1.5;
      rr(m.x + 1, m.y + 1, m.w - 2, 11, 5); ctx.stroke();
      // flèches de direction
      ctx.fillStyle = hexA('#ffffff', 0.5);
      for (let i = 0; i < 3; i++) {
        const cx = m.x + 14 + i * 18;
        const dir = Math.sin(Game.time * 4 + i) > 0 ? 1 : 1;
        ctx.beginPath();
        if (m.axis === 'x') { ctx.moveTo(cx, m.y + 6.5); ctx.lineTo(cx + (dir > 0 ? 5 : -5), m.y + 3.5); ctx.lineTo(cx + (dir > 0 ? 5 : -5), m.y + 9.5); }
        else { ctx.moveTo(cx, m.y + 9); ctx.lineTo(cx + 4, m.y + 4); ctx.lineTo(cx + 8, m.y + 9); }
        ctx.closePath(); ctx.fill();
      }
      // propulseur
      const pulse = 0.5 + 0.5 * Math.sin(Game.time * 8);
      ctx.fillStyle = hexA(th.accent, 0.3 + pulse * 0.25);
      ctx.beginPath();
      ctx.ellipse(m.x + m.w / 2, m.y + 16, m.w * 0.22, 3 + pulse * 3, 0, 0, 6.283);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ========================================================== CHECKPOINTS / BUT */
  function drawCheckpoints(camX) {
    const th = Game.level.theme;
    for (const c of Game.level.checkpoints) {
      if (!onScreen(c.x, camX)) continue;
      const t = Game.time;
      ctx.save();
      // socle
      ctx.fillStyle = hexA('#000000', 0.35);
      ctx.beginPath(); ctx.ellipse(c.x, c.y + 2, 22, 6, 0, 0, 6.283); ctx.fill();
      // mât
      const h = 92;
      ctx.strokeStyle = c.active ? hexA(th.accent, 0.9) : 'rgba(180,170,200,.45)';
      ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x, c.y - h); ctx.stroke();
      // fanion
      const wave = Math.sin(t * (c.active ? 5 : 1.5) + c.x) * 5;
      ctx.beginPath();
      ctx.moveTo(c.x + 1, c.y - h + 3);
      ctx.quadraticCurveTo(c.x + 26, c.y - h + 8 + wave, c.x + 44, c.y - h + 20 + wave);
      ctx.quadraticCurveTo(c.x + 26, c.y - h + 30 + wave, c.x + 1, c.y - h + 36);
      ctx.closePath();
      if (c.active) {
        ctx.shadowColor = hexA(th.accent, 0.9); ctx.shadowBlur = 20;
        ctx.fillStyle = hexA(th.accent, 0.92);
      } else {
        ctx.fillStyle = 'rgba(150,140,170,.28)';
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      if (c.active) {
        ctx.fillStyle = hexA('#ffffff', 0.5 + 0.3 * Math.sin(t * 4));
        ctx.beginPath(); ctx.arc(c.x, c.y - h - 6, 3.5, 0, 6.283); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawGoal(camX) {
    const th = Game.level.theme;
    const g = Game.level.goal;
    if (!onScreen(g.x, camX, 200)) return;
    const t = Game.time;
    ctx.save();
    // halo au sol
    const gl = ctx.createRadialGradient(g.x, g.y, 4, g.x, g.y, 130);
    gl.addColorStop(0, hexA(th.glow, 0.35)); gl.addColorStop(1, hexA(th.accent, 0));
    ctx.fillStyle = gl;
    ctx.fillRect(g.x - 130, g.y - 130, 260, 150);
    // piliers
    for (const s of [-1, 1]) {
      ctx.fillStyle = hexA(th.accent, 0.16);
      ctx.fillRect(g.x + s * 44 - 5, g.y - 150, 10, 150);
      ctx.fillStyle = hexA(th.glow, 0.5);
      ctx.fillRect(g.x + s * 44 - 1.5, g.y - 150, 3, 150);
    }
    // anneaux
    ctx.translate(g.x, g.y - 72);
    for (let i = 0; i < 3; i++) {
      const ph = t * (1.1 + i * 0.35) + i * 2.1;
      ctx.save();
      ctx.rotate(Math.sin(ph) * 0.35);
      ctx.scale(1, 0.28 + 0.62 * Math.abs(Math.cos(ph * 0.7)));
      ctx.strokeStyle = hexA(i === 1 ? th.accent2 : th.accent, 0.75);
      ctx.lineWidth = 3.2;
      ctx.shadowColor = hexA(th.accent, 0.9); ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(0, 0, 40 + i * 5, 0, 6.283); ctx.stroke();
      ctx.restore();
    }
    // coeur
    const pulse = 1 + Math.sin(t * 3.4) * 0.07;
    ctx.shadowBlur = 30; ctx.shadowColor = hexA('#ffffff', 0.9);
    const core = ctx.createRadialGradient(0, 0, 2, 0, 0, 28 * pulse);
    core.addColorStop(0, '#ffffff'); core.addColorStop(0.45, hexA(th.glow, 0.95)); core.addColorStop(1, hexA(th.accent, 0));
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, 0, 28 * pulse, 0, 6.283); ctx.fill();
    ctx.shadowBlur = 0;
    // particules montantes
    if (Math.random() < 0.35) {
      part({ x: g.x + rnd(-38, 38), y: g.y - 10, vx: rnd(-12, 12), vy: rnd(-90, -40), life: rnd(0.7, 1.4), max: 1.4, size: rnd(1.5, 3.2), color: th.glow, grav: -30, type: 'dot' });
    }
    ctx.restore();
  }

  /* ========================================================== ENNEMIS */
  function drawEnemies(camX) {
    const th = Game.level.theme;
    const p = Game.player;
    for (const e of Game.level.enemies) {
      if (!onScreen(e.x, camX)) continue;
      if (e.dead) {
        if (e.deadT > 0) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, e.deadT / 0.4);
          ctx.translate(e.x + e.w / 2, e.y + e.h);
          ctx.scale(1 + (0.4 - e.deadT) * 2, 0.2);
          ctx.fillStyle = hexA(th.accent2, 0.6);
          rr(-e.w / 2, -e.h, e.w, e.h, 10); ctx.fill();
          ctx.restore();
        }
        continue;
      }
      ctx.save();
      if (e.t === 'walker') {
        const wob = Math.sin(Game.time * 9 + e.x * 0.06);
        ctx.translate(e.x + e.w / 2, e.y + e.h);
        ctx.rotate(wob * 0.05);
        // jambes
        ctx.fillStyle = '#2b1a3a';
        for (const s of [-1, 1]) {
          const off = Math.sin(Game.time * 10 + (s > 0 ? 0 : Math.PI) + e.x * 0.05) * 3;
          rr(s * 9 - 4, -8 - Math.max(0, off), 8, 9, 3); ctx.fill();
        }
        // corps
        const g = ctx.createLinearGradient(0, -e.h, 0, 0);
        g.addColorStop(0, '#ff8fae'); g.addColorStop(1, '#c9316a');
        ctx.fillStyle = g;
        ctx.shadowColor = 'rgba(255,93,143,.75)'; ctx.shadowBlur = 16;
        rr(-e.w / 2, -e.h, e.w, e.h - 3, 11); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,220,235,.8)'; ctx.lineWidth = 1.6;
        rr(-e.w / 2, -e.h, e.w, e.h - 3, 11); ctx.stroke();
        // yeux
        const look = p ? clamp((p.x - e.x) / 260, -1, 1) : 0;
        for (const s of [-1, 1]) {
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.ellipse(s * 7, -e.h + 12, 5, 6, 0, 0, 6.283); ctx.fill();
          ctx.fillStyle = '#25102a';
          ctx.beginPath(); ctx.arc(s * 7 + look * 2, -e.h + 12.5, 2.6, 0, 6.283); ctx.fill();
        }
        // sourcils
        ctx.strokeStyle = '#8e1b47'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-11, -e.h + 5); ctx.lineTo(-4, -e.h + 7.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(11, -e.h + 5); ctx.lineTo(4, -e.h + 7.5); ctx.stroke();
      } else if (e.t === 'hopper') {
        const squash = e.onGround ? 1 + Math.sin(Game.time * 6 + e.x) * 0.04 : 0.94;
        ctx.translate(e.x + e.w / 2, e.y + e.h);
        ctx.scale(e.sx / squash, e.sy * squash);
        // pattes
        ctx.strokeStyle = '#5cffb8'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(s * 8, -8); ctx.lineTo(s * 15, 0); ctx.stroke();
        }
        const g = ctx.createLinearGradient(0, -e.h, 0, 0);
        g.addColorStop(0, '#9dffd0'); g.addColorStop(1, '#17a86e');
        ctx.fillStyle = g;
        ctx.shadowColor = 'rgba(60,255,180,.7)'; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.ellipse(0, -e.h / 2, e.w / 2, e.h / 2, 0, 0, 6.283); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(230,255,245,.8)'; ctx.lineWidth = 1.5; ctx.stroke();
        for (const s of [-1, 1]) {
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(s * 6, -e.h * 0.62, 4.4, 0, 6.283); ctx.fill();
          ctx.fillStyle = '#0c3a28';
          ctx.beginPath(); ctx.arc(s * 6 + (e.dir > 0 ? 1.4 : -1.4), -e.h * 0.62, 2.2, 0, 6.283); ctx.fill();
        }
      } else { // flyer
        const flap = Math.sin(Game.time * 9 + e.phase) * 0.5 + 0.5;
        ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
        // ailes
        for (const s of [-1, 1]) {
          ctx.save();
          ctx.scale(s, 1);
          ctx.rotate(-0.4 - flap * 0.55);
          ctx.fillStyle = hexA(th.accent2, 0.55);
          ctx.beginPath();
          ctx.moveTo(8, -2); ctx.quadraticCurveTo(30, -20, 40, -2); ctx.quadraticCurveTo(26, 4, 8, 4);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        // orbe
        const g = ctx.createRadialGradient(-4, -4, 2, 0, 0, 18);
        g.addColorStop(0, '#ffd9f4'); g.addColorStop(0.6, '#c74fd8'); g.addColorStop(1, '#5a1d78');
        ctx.fillStyle = g;
        ctx.shadowColor = 'rgba(220,120,255,.8)'; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, 6.283); ctx.fill();
        ctx.shadowBlur = 0;
        // oeil
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(0, 0, 8, 9.5, 0, 0, 6.283); ctx.fill();
        const look = p ? clamp((p.x - e.x) / 300, -1, 1) : 0;
        ctx.fillStyle = '#2a0c3a';
        ctx.beginPath(); ctx.arc(look * 3, (p ? clamp((p.y - e.y) / 300, -1, 1) : 0) * 2.5, 4.4, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        ctx.beginPath(); ctx.arc(look * 3 - 1.6, -1.6, 1.5, 0, 6.283); ctx.fill();
        // contour
        ctx.strokeStyle = 'rgba(255,220,255,.65)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, 6.283); ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* ========================================================== SKINS */
  // Personnages dessinés en formes vectorielles néon : couleurs et accessoires
  // reconnaissables (chapeau de paille, bandeau, chevelures…), aucun asset externe.
  const SKINS = [
    {
      id: 'nova', name: 'Nova', tag: 'NOVA RUN', unlock: null,
      body: ['#a8f7ff', '#4ce0ff', '#5f6bff'], glow: 'rgba(94,240,255,.8)',
      arm: '#4ce0ff', leg: '#3d2b6b', scarf: '#ff5d8f',
      head: 'visor', emblem: { type: 'diamond', color: '#ff5d8f' },
    },
    {
      id: 'luffy', name: 'Luffy', tag: 'ONE PIECE', unlock: 5,
      body: ['#ff8a6b', '#e83a2e', '#a81f1f'], glow: 'rgba(255,90,70,.75)',
      arm: '#f0c8a0', leg: '#2b4a8f', scarf: '#ffd24a',
      head: 'straw', skin: '#f0c8a0', emblem: null, scar: true,
    },
    {
      id: 'zoro', name: 'Zoro', tag: 'ONE PIECE', unlock: 5,
      body: ['#8df0b0', '#2fae6a', '#157a48'], glow: 'rgba(80,230,140,.7)',
      arm: '#f0c8a0', leg: '#1f3a2e', scarf: '#e8f5e8',
      head: 'green', skin: '#f0c8a0', emblem: null, eyeScar: true,
    },
    {
      id: 'subaru', name: 'Subaru', tag: 'RE:ZERO', unlock: 6,
      body: ['#4a5068', '#262a3d', '#141622'], glow: 'rgba(150,160,200,.65)',
      arm: '#262a3d', leg: '#1a1c28', scarf: '#f4f0ff',
      head: 'black', skin: '#f2d0b4', emblem: { type: 'stripe' },
    },
    {
      id: 'emilia', name: 'Emilia', tag: 'RE:ZERO', unlock: 6,
      body: ['#f6f1ff', '#d4c6ff', '#9a86e0'], glow: 'rgba(210,195,255,.8)',
      arm: '#f6f1ff', leg: '#e6e0f8', scarf: '#c9b8ff',
      head: 'silver', skin: '#fbe6da', emblem: { type: 'flower' },
    },
    {
      id: 'rem', name: 'Rem', tag: 'RE:ZERO', unlock: 6,
      body: ['#46567e', '#232f52', '#10182a'], glow: 'rgba(140,190,255,.75)',
      arm: '#f2ecff', leg: '#10182a', scarf: '#9fd8ff',
      head: 'blue', skin: '#fbe6da', emblem: { type: 'apron' },
    },
    {
      id: 'naruto', name: 'Naruto', tag: 'SHONEN', unlock: 7,
      body: ['#ffc163', '#ff8a1e', '#d85f10'], glow: 'rgba(255,150,50,.75)',
      arm: '#f4d0a8', leg: '#2a2f3a', scarf: '#ff5d5d',
      head: 'blondband', skin: '#f4d0a8', emblem: { type: 'swirl' }, whiskers: true,
    },
    {
      id: 'goku', name: 'Goku', tag: 'SHONEN', unlock: 7,
      body: ['#ffa65d', '#ff6a1e', '#d84a10'], glow: 'rgba(255,140,60,.75)',
      arm: '#f4d0a8', leg: '#1e4fbf', scarf: '#3aa0ff',
      head: 'blackspiky', skin: '#f4d0a8', emblem: { type: 'belt' },
    },
  ];

  let skinId = 'nova';
  const getSkin = () => SKINS.find(s => s.id === skinId) || SKINS[0];

  function rrect(c, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* ---------- emblèmes de poitrine */
  function paintEmblem(c, sk, top) {
    const e = sk.emblem;
    if (!e) return;
    if (e.type === 'diamond') {
      c.fillStyle = 'rgba(10,20,45,.55)';
      rrect(c, -7, top + 14, 14, 12, 4); c.fill();
      c.fillStyle = hexA(e.color, 0.95);
      c.beginPath();
      c.moveTo(0, top + 17); c.lineTo(4.6, top + 22); c.lineTo(0, top + 27); c.lineTo(-4.6, top + 22);
      c.closePath(); c.fill();
    } else if (e.type === 'stripe') {
      c.strokeStyle = 'rgba(244,240,255,.85)'; c.lineWidth = 2.2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-9.5, top + 13); c.lineTo(-9.5, top + 27); c.stroke();
      c.beginPath(); c.moveTo(9.5, top + 13); c.lineTo(9.5, top + 27); c.stroke();
    } else if (e.type === 'flower') {
      const fx = 0, fy = top + 21;
      c.fillStyle = '#b79cff';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * 6.283;
        c.beginPath(); c.arc(fx + Math.cos(a) * 3.4, fy + Math.sin(a) * 3.4, 2.1, 0, 6.283); c.fill();
      }
      c.fillStyle = '#ffe9a0';
      c.beginPath(); c.arc(fx, fy, 1.8, 0, 6.283); c.fill();
    } else if (e.type === 'apron') {
      c.fillStyle = 'rgba(242,236,255,.94)';
      rrect(c, -6, top + 15, 12, 13, 3); c.fill();
      c.strokeStyle = 'rgba(180,200,240,.9)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(-6, top + 25); c.lineTo(6, top + 25); c.stroke();
    } else if (e.type === 'swirl') {
      c.strokeStyle = '#3a2030'; c.lineWidth = 1.6;
      c.beginPath(); c.arc(0, top + 21, 4.6, 0, 6.283); c.stroke();
      c.beginPath(); c.arc(0, top + 21, 2.6, 0, 4.2); c.stroke();
      c.fillStyle = '#d83a2e';
      c.beginPath(); c.arc(0, top + 21, 1.5, 0, 6.283); c.fill();
    } else if (e.type === 'belt') {
      c.fillStyle = '#1e4fbf';
      rrect(c, -11, top + 24, 22, 4.4, 2); c.fill();
      c.fillStyle = '#f4f0ff';
      rrect(c, -1.8, top + 24.6, 3.6, 3.2, 1); c.fill();
    }
  }

  /* ---------- coiffes / chevelures */
  function hairSpikes(c, color, top, pts) {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(-9.5, top + 7);
    for (const [x, y] of pts) c.lineTo(x, top + y);
    c.lineTo(9.5, top + 7);
    c.closePath(); c.fill();
  }

  function paintHead(c, sk, p, top) {
    const eyeX = p.dir * 2.2;
    if (sk.head === 'visor') {
      c.fillStyle = '#0d1330';
      rrect(c, -9, top + 4, 18, 11, 5); c.fill();
      if (p.blink > 0 || p.blink < -0.09) {
        c.fillStyle = '#b8fbff';
        rrect(c, -6 + eyeX, top + 8, 12, 3.2, 1.6); c.fill();
      } else {
        c.fillStyle = 'rgba(184,251,255,.95)';
        rrect(c, -6 + eyeX, top + 8.6, 12, 2.4, 1.2); c.fill();
      }
      c.fillStyle = 'rgba(255,255,255,.85)';
      c.beginPath(); c.arc(-5 + eyeX, top + 6.6, 1.3, 0, 6.283); c.fill();
      return;
    }

    // chevelure longue (Émilia) : derrière le visage
    if (sk.head === 'silver') {
      c.fillStyle = '#e9e6f7';
      rrect(c, -10.5, top + 4, 5, 27, 2.4); c.fill();
      rrect(c, 5.5, top + 4, 5, 27, 2.4); c.fill();
    }

    // visage
    c.fillStyle = sk.skin;
    rrect(c, -9, top + 3, 18, 12, 5.5); c.fill();

    // yeux
    const blink = p.blink <= 0 && p.blink >= -0.09;
    if (sk.eyeScar) {
      // œil gauche fermé (cicatrice), œil droit ouvert
      c.strokeStyle = '#2a1c22'; c.lineWidth = 1.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-6.4 + eyeX, top + 10.4); c.lineTo(-2.6 + eyeX, top + 9.2); c.stroke();
      if (blink) { c.beginPath(); c.moveTo(2.4 + eyeX, top + 10); c.lineTo(5.8 + eyeX, top + 10); c.stroke(); }
      else { c.fillStyle = '#2a1c22'; c.beginPath(); c.ellipse(4 + eyeX, top + 9.6, 1.7, 2.3, 0, 0, 6.283); c.fill(); }
    } else if (blink) {
      c.strokeStyle = '#2a1c22'; c.lineWidth = 1.3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-6 + eyeX, top + 10); c.lineTo(-2.8 + eyeX, top + 10); c.stroke();
      c.beginPath(); c.moveTo(2.8 + eyeX, top + 10); c.lineTo(6 + eyeX, top + 10); c.stroke();
    } else {
      c.fillStyle = '#2a1c22';
      c.beginPath(); c.ellipse(-4.2 + eyeX, top + 9.6, 1.7, 2.3, 0, 0, 6.283); c.fill();
      c.beginPath(); c.ellipse(4.2 + eyeX, top + 9.6, 1.7, 2.3, 0, 0, 6.283); c.fill();
      c.fillStyle = 'rgba(255,255,255,.85)';
      c.beginPath(); c.arc(-4.7 + eyeX, top + 8.8, 0.7, 0, 6.283); c.fill();
      c.beginPath(); c.arc(3.7 + eyeX, top + 8.8, 0.7, 0, 6.283); c.fill();
    }

    // moustaches de Naruto
    if (sk.whiskers) {
      c.strokeStyle = 'rgba(120,70,40,.75)'; c.lineWidth = 0.9; c.lineCap = 'round';
      for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
        c.beginPath();
        c.moveTo(s * 5.4, top + 10.6 + i * 2);
        c.lineTo(s * 8.6, top + 10.2 + i * 2);
        c.stroke();
      }
    }
    // couture sous l'œil de Luffy
    if (sk.scar) {
      c.strokeStyle = '#9a5a44'; c.lineWidth = 1; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-6.2 + eyeX, top + 12.2); c.lineTo(-3.4 + eyeX, top + 13.2); c.stroke();
      c.beginPath(); c.moveTo(-5.4 + eyeX, top + 12.2); c.lineTo(-5.4 + eyeX, top + 13.4); c.stroke();
    }

    // coiffes
    if (sk.head === 'straw') {
      // cheveux noirs sous le chapeau
      c.fillStyle = '#241a18';
      rrect(c, -9, top + 2.5, 18, 4.5, 2); c.fill();
      // dôme
      c.fillStyle = '#f0dd9a';
      c.beginPath(); c.arc(0, top + 4.4, 8.6, Math.PI, 0); c.fill();
      // bandeau rouge
      c.fillStyle = '#d23b3b';
      rrect(c, -8.6, top + 2.2, 17.2, 3, 1.4); c.fill();
      // ailes
      c.fillStyle = '#e8d290';
      c.beginPath(); c.ellipse(0, top + 4.6, 13.4, 3.1, 0, 0, 6.283); c.fill();
      c.strokeStyle = 'rgba(150,120,60,.8)'; c.lineWidth = 1;
      c.beginPath(); c.ellipse(0, top + 4.6, 13.4, 3.1, 0, 0, 6.283); c.stroke();
    } else if (sk.head === 'green') {
      hairSpikes(c, '#37c96f', top, [[-8, 2], [-6, 5.4], [-3, 1.6], [0, 5], [3, 1.8], [6, 5.2], [8, 2.4]]);
      c.fillStyle = '#37c96f';
      rrect(c, -9.6, top + 4, 4, 8, 2); c.fill();
    } else if (sk.head === 'black') {
      hairSpikes(c, '#23202c', top, [[-7.5, 2.6], [-5, 6], [-2, 2.2], [1, 5.6], [4, 2.4], [7.5, 5.4]]);
    } else if (sk.head === 'silver') {
      hairSpikes(c, '#e9e6f7', top, [[-8, 2.4], [-5.5, 5.6], [-2.5, 2], [0.5, 5.4], [3.5, 2.2], [7, 5.2]]);
      // fleur sur le côté
      c.fillStyle = '#f4b8e0';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * 6.283;
        c.beginPath(); c.arc(-8 + Math.cos(a) * 1.9, top + 4.4 + Math.sin(a) * 1.9, 1.3, 0, 6.283); c.fill();
      }
      c.fillStyle = '#ffe9a0';
      c.beginPath(); c.arc(-8, top + 4.4, 1, 0, 6.283); c.fill();
    } else if (sk.head === 'blue') {
      hairSpikes(c, '#7fc4ff', top, [[-8, 2.2], [-5, 5.2], [-2, 2], [1, 5], [4, 2.2], [7.5, 5]]);
      // carré du bob
      c.fillStyle = '#7fc4ff';
      rrect(c, -10, top + 4, 4.4, 11, 2.2); c.fill();
      rrect(c, 5.6, top + 4, 4.4, 11, 2.2); c.fill();
      // ruban
      c.fillStyle = '#ff9ecb';
      c.beginPath();
      c.moveTo(7.4, top + 4.6); c.lineTo(11, top + 2.6); c.lineTo(10.6, top + 6.6);
      c.closePath(); c.fill();
    } else if (sk.head === 'blondband') {
      hairSpikes(c, '#ffd24d', top, [[-8.5, 1.4], [-6, 4.8], [-3, 1], [0, 4.6], [3, 1.2], [6, 4.6], [8.5, 1.6]]);
      // bandeau
      c.fillStyle = '#1d3a7a';
      rrect(c, -9.6, top + 4.4, 19.2, 4, 1.6); c.fill();
      c.fillStyle = '#b9c6d8';
      rrect(c, -3.4, top + 4.9, 6.8, 3, 1); c.fill();
      c.fillStyle = '#5a6a82';
      c.beginPath(); c.arc(0, top + 6.4, 0.9, 0, 6.283); c.fill();
    } else if (sk.head === 'blackspiky') {
      hairSpikes(c, '#1d1a22', top, [[-9, 0.6], [-6.5, 4.6], [-4, -0.6], [-1, 4.2], [1.5, -0.8], [4.5, 4], [7, 0.4], [9, 3.6]]);
    }
  }

  /* ---------- peinture complète du personnage (contexte arbitraire) */
  function paintAvatar(c, sk, p, t) {
    const top = -p.h;
    const run = p.onGround ? Math.sin(p.runPhase) : 0;
    const legY = -9;
    // jambes
    c.fillStyle = sk.leg;
    if (!p.onGround) {
      rrect(c, -8, legY, 7, 8, 3); c.fill();
      rrect(c, 2, legY - 2, 7, 7, 3); c.fill();
    } else {
      rrect(c, -8 + run * 2, legY - Math.max(0, run) * 2, 7, 8, 3); c.fill();
      rrect(c, 2 - run * 2, legY - Math.max(0, -run) * 2, 7, 8, 3); c.fill();
    }
    // corps
    const g = c.createLinearGradient(0, top, 0, 0);
    g.addColorStop(0, sk.body[0]); g.addColorStop(0.45, sk.body[1]); g.addColorStop(1, sk.body[2]);
    c.fillStyle = g;
    c.shadowColor = sk.glow; c.shadowBlur = 18;
    rrect(c, -p.w / 2 + 1, top + 1, p.w - 2, p.h - 3, 9); c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.6;
    rrect(c, -p.w / 2 + 1, top + 1, p.w - 2, p.h - 3, 9); c.stroke();

    paintEmblem(c, sk, top);
    paintHead(c, sk, p, top);

    // bras
    c.fillStyle = sk.arm;
    const armSwing = p.onGround ? Math.cos(p.runPhase) * 3 : -4;
    rrect(c, p.dir * 9 - 2, top + 17 + armSwing, 5.4, 10, 2.6); c.fill();
    if (sk.id === 'goku') {
      c.fillStyle = '#1e4fbf';
      rrect(c, p.dir * 9 - 2.4, top + 24 + armSwing, 6.2, 3.4, 1.6); c.fill();
    }
  }

  /* ---------- vignette pour l'écran de sélection */
  function drawSkinPreview(canvas, id) {
    const sk = SKINS.find(s => s.id === id) || SKINS[0];
    const c = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = 180, H = 180;
    canvas.width = W * dpr; canvas.height = H * dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const halo = c.createRadialGradient(W / 2, H * 0.7, 6, W / 2, H * 0.7, 84);
    halo.addColorStop(0, hexA(sk.body[1], 0.32)); halo.addColorStop(1, hexA(sk.body[1], 0));
    c.fillStyle = halo; c.fillRect(0, 0, W, H);
    // ombre au sol
    c.fillStyle = 'rgba(0,0,0,.3)';
    c.beginPath(); c.ellipse(W / 2, H * 0.88, 26, 6, 0, 0, 6.283); c.fill();
    c.save();
    c.translate(W / 2, H * 0.86);
    c.scale(2.6, 2.6);
    // écharpe statique
    c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      c.strokeStyle = hexA(sk.scarf, 0.85 - i * 0.2);
      c.lineWidth = 6 - i * 1.4;
      c.beginPath();
      c.moveTo(-4, -30 + i * 3);
      c.quadraticCurveTo(-12 - i * 3, -27 + i * 3, -16 - i * 4, -22 + i * 4);
      c.stroke();
    }
    paintAvatar(c, sk, { w: 26, h: 36, dir: 1, onGround: true, runPhase: 0.5, blink: 1 }, performance.now() / 1000);
    c.restore();
  }

  /* ========================================================== JOUEUR */
  function drawPlayer() {
    const p = Game.player;
    if (!p || p.dead) return;
    const th = Game.level.theme;
    const sk = getSkin();
    const cx = p.x + p.w / 2, feet = p.y + p.h;

    // traînées de dash
    for (const t of p.trail) {
      ctx.save();
      ctx.globalAlpha = (t.life / 0.22) * 0.35;
      ctx.translate(t.x + p.w / 2, t.y + p.h);
      ctx.scale(p.sx, p.sy);
      ctx.fillStyle = sk.glow;
      rr(-p.w / 2, -p.h, p.w, p.h, 9); ctx.fill();
      ctx.restore();
    }

    // ombre
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath(); ctx.ellipse(cx, feet + 2, 15, 4.4, 0, 0, 6.283); ctx.fill();
    ctx.restore();

    const blinkOff = p.invuln > 0 && Math.floor(Game.time * 22) % 2 === 0;
    if (blinkOff) ctx.globalAlpha = 0.45;

    // écharpe (couleur du skin)
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = p.scarf.length - 1; i > 0; i--) {
      const a = p.scarf[i - 1], b = p.scarf[i];
      const w = 7.5 * (1 - i / (p.scarf.length + 1));
      ctx.strokeStyle = hexA(sk.scarf, 0.9 - i * 0.09);
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(cx, feet);
    ctx.scale(p.sx, p.sy);
    const spin = p.spinT > 0 ? (1 - p.spinT / 0.45) * Math.PI * 2 * p.dir : 0;
    if (spin) { ctx.translate(0, -p.h / 2); ctx.rotate(spin); ctx.translate(0, p.h / 2); }
    paintAvatar(ctx, sk, p, Game.time);
    ctx.restore();
    ctx.globalAlpha = 1;

    // effet de mur
    if (p.wallSliding) {
      const sx = p.wallDir > 0 ? p.x + p.w : p.x;
      ctx.save();
      ctx.globalAlpha = 0.5;
      const g2 = ctx.createLinearGradient(sx, 0, sx - p.wallDir * 26, 0);
      g2.addColorStop(0, hexA('#ffffff', 0.5)); g2.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(Math.min(sx, sx - p.wallDir * 26), p.y + 2, 26, p.h - 4);
      ctx.restore();
    }
    // aura de dash
    if (p.dashT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = th.accent; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const o = 16 + i * 9;
        ctx.beginPath();
        ctx.moveTo(cx - p.dashDir * o, p.y + 8 + i * 9);
        ctx.lineTo(cx - p.dashDir * (o + 14), p.y + 8 + i * 9);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* ========================================================== PARTICULES */
  function drawParticles(camX) {
    for (const q of Game.particles) {
      if (!onScreen(q.x, camX, 80)) continue;
      const a = Math.max(0, q.life / q.max);
      ctx.globalAlpha = a;
      if (q.type === 'ring') {
        ctx.strokeStyle = q.color;
        ctx.lineWidth = 2.4 * a;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1.8 - a * 1.2), 0, 6.283); ctx.stroke();
      } else if (q.type === 'square') {
        ctx.save();
        ctx.translate(q.x, q.y); ctx.rotate(q.rot);
        ctx.fillStyle = q.color;
        ctx.fillRect(-q.size / 2, -q.size / 2, q.size, q.size);
        ctx.restore();
      } else if (q.type === 'spark') {
        ctx.strokeStyle = q.color;
        ctx.lineWidth = Math.max(0.8, q.size * 0.55);
        ctx.beginPath();
        ctx.moveTo(q.x, q.y);
        ctx.lineTo(q.x - q.vx * 0.02, q.y - q.vy * 0.02);
        ctx.stroke();
      } else {
        ctx.fillStyle = q.color;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.4 + a * 0.8), 0, 6.283); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawFloats(camX) {
    ctx.textAlign = 'center';
    for (const f of Game.floats) {
      if (!onScreen(f.x, camX, 60)) continue;
      const a = Math.max(0, f.life / f.max);
      ctx.globalAlpha = a;
      ctx.font = `800 ${f.size}px ui-rounded, system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  /* ========================================================== MÉTÉO / POST */
  function drawWeatherBack(L, camX) {
    const w = L.theme.weather || 'motes';
    ctx.save();
    for (const q of Game.weather) {
      if (q.x < -40 || q.x > VW + 40) continue;
      ctx.globalAlpha = q.a * (w === 'motes' ? 0.5 : 0.7);
      if (w === 'rain') {
        ctx.strokeStyle = 'rgba(190,230,255,.75)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - 3, q.y + 16); ctx.stroke();
      } else if (w === 'snow') {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.283); ctx.fill();
      } else if (w === 'embers') {
        ctx.fillStyle = hexA('#ffb26b', 0.9);
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.283); ctx.fill();
      } else {
        ctx.fillStyle = hexA(L.theme.glow, 0.8);
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.283); ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawWeatherFront(L) {
    const w = L.theme.weather || 'motes';
    if (w === 'rain') {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = '#9fd8ff'; ctx.lineWidth = 1;
      for (let i = 0; i < 26; i++) {
        const x = (i * 137 + (Game.time * 260) % VW) % VW;
        const y = (i * 97 + (Game.time * 900) % VH) % VH;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 24); ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawVignette() {
    if (!vignette) {
      vignette = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VH * 0.95);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,.42)');
    }
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VW, VH);
  }

  function drawFlash() {
    if (Game.lightning > 0) {
      ctx.fillStyle = `rgba(220,200,255,${Game.lightning * 0.35})`;
      ctx.fillRect(0, 0, VW, VH);
    }
    if (Game.flash > 0) {
      const c = Game.flashColor.startsWith('#') ? hexA(Game.flashColor, Game.flash * 0.5) : Game.flashColor.replace(/[\d.]+\)$/, (Game.flash * 0.45) + ')');
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, VW, VH);
    }
  }

  /* ========================================================== DEBUG */
  function drawDebug() {
    const p0 = Game.player;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#fff'; ctx.font = '12px monospace';
    ctx.fillText(`x:${Math.round(p0 ? p0.x : 0)} y:${Math.round(p0 ? p0.y : 0)} vx:${Math.round(p0 ? p0.vx : 0)} vy:${Math.round(p0 ? p0.vy : 0)}`, 12, VH - 14);
    ctx.setTransform(dpr * ZOOM, 0, 0, dpr * ZOOM, -Game.cam.x * ZOOM * dpr, -Game.cam.y * ZOOM * dpr);
    const L = Game.level, p = Game.player;
    ctx.strokeStyle = '#0f0'; ctx.lineWidth = 1;
    for (const s of L.def.solids) ctx.strokeRect(s[0], s[1], s[2], s[3]);
    ctx.strokeStyle = '#0ff';
    for (const pl of L.plats) ctx.strokeRect(pl.x, pl.y, pl.w, pl.h);
    ctx.strokeStyle = '#f0f';
    for (const m of L.movers) ctx.strokeRect(m.x, m.y, m.w, m.h);
    ctx.strokeStyle = '#ff0';
    for (const q of L.enemies) ctx.strokeRect(q.x, q.y, q.w, q.h);
    ctx.strokeStyle = '#f00';
    for (const s of L.spikes) ctx.strokeRect(s.x, s.y, s.w, s.h);
    if (p) { ctx.strokeStyle = '#fff'; ctx.strokeRect(p.x, p.y, p.w, p.h); }
    ctx.restore();
  }

  /* ========================================================== UTILS */
  function hexA(hex, a) {
    if (hex.startsWith('#')) {
      const h = hex.length === 4
        ? '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3] : hex;
      const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${a})`;
    }
    if (hex.startsWith('rgba')) return hex.replace(/[\d.]+\)$/, a + ')');
    return hex;
  }

  function adjust(hex, amt) {
    const h = hex.length === 4
      ? '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3] : hex;
    const clamp255 = (v) => Math.max(0, Math.min(255, v));
    const r = clamp255(parseInt(h.slice(1, 3), 16) + amt);
    const g = clamp255(parseInt(h.slice(3, 5), 16) + amt);
    const b = clamp255(parseInt(h.slice(5, 7), 16) + amt);
    return `rgb(${r},${g},${b})`;
  }

  return {
    init, draw, resize,
    toggleDebug() { debug = !debug; },
    get debug() { return debug; },
    setQuality,
    SKINS,
    setSkin(id) { if (SKINS.some(s => s.id === id)) skinId = id; },
    getSkin: getSkin,
    drawSkinPreview,
  };
})();
