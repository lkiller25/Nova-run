/* ============================================================
   NOVA RUN — interface, sauvegarde, entrées, boucle principale
   ============================================================ */
const UI = (function () {
  const KEY = 'novarun.save.v2';
  const HINTS = {
    wall: 'Astuce : contre un mur, saute à nouveau pour t\'élever !',
    spring: 'Ressort ! Garde l\'élan et enchaîne avec un saut.',
    crumble: 'Cette dalle s\'effondre — ne t\'arrête pas !',
    mover: 'Plateforme mobile : lis son rythme avant de sauter.',
    dash: 'Dash ! Un par saut, réinitialisé au sol ou sur un mur.',
    enemy: 'Saute sur la tête des ennemis pour les éliminer.',
  };

  let save = {
    unlocked: 1, lastIdx: 0, best: {}, music: true, sfx: true, muted: false,
    skin: 'nova',
  };
  const maxStars = () => LEVELS.length * 3;
  let els = {};
  let touch = { left: false, right: false, jump: false, dash: false, pendingJump: false, pendingDash: false };
  const keys = {};
  const pad = { left: false, right: false, jump: false, dash: false, down: false, ok: false };
  let toastTimer = null, toastQueue = [], resetArmed = false, starsTimers = [];

  /* ---------------------------------------------------------- sauvegarde */
  function loadSave() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        save = Object.assign(save, s);
        if (!save.best) save.best = {};
      }
    } catch (e) { /* stockage indisponible (iframe sandbox) */ }
  }
  function writeSave() {
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* silencieux */ }
  }

  const stars = (b) => (b ? b.stars || 0 : 0);
  const totalStars = () => Object.values(save.best).reduce((a, b) => a + stars(b), 0);
  const fmt = (t) => {
    t = Math.max(0, t);
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + String(s).padStart(2, '0');
  };
  const fmtMs = (t) => {
    t = Math.max(0, t);
    const m = Math.floor(t / 60), s = t % 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  };

  /* ---------------------------------------------------------- écrans */
  const SCREENS = {
    menu: 'scr-menu', levels: 'scr-levels', skins: 'scr-skins', intro: 'scr-intro',
    pause: 'scr-pause', complete: 'scr-complete', ending: 'scr-ending',
  };

  function showScreen(name) {
    Object.values(SCREENS).forEach(id => els[id].classList.add('hidden'));
    if (name && SCREENS[name]) els[SCREENS[name]].classList.remove('hidden');
    els.hud.classList.toggle('hidden', !(name === 'play' || name === 'pause' || name === 'complete' || name === null));
    els.progress.classList.toggle('on', name === 'play' || name === null);
    els.touch.classList.toggle('hidden', !(name === null || name === 'play' || name === 'pause') || !isTouch());
    if (name === 'menu') refreshMenu();
    if (name === 'levels') buildLevelCards();
    if (name === 'skins') buildSkinCards();
  }

  function applyTheme() {
    const th = Game.level && Game.level.theme;
    if (!th) return;
    const f = els.frame;
    f.style.setProperty('--accent', th.ui || th.accent);
    f.style.setProperty('--accent2', th.accent2);
    f.style.setProperty('--glow', th.glow);
  }

  /* ---------------------------------------------------------- menu */
  function refreshMenu() {
    els.menuStars.textContent = totalStars() + ' / ' + maxStars();
    if (els.menuStarsLabel) els.menuStarsLabel.textContent = 'étoiles / ' + maxStars();
    if (els.logoSub) els.logoSub.textContent = 'Un jeu de plateforme néon · ' + LEVELS.length + ' mondes · skins animés';
    els.menuGems.textContent = Object.values(save.best).reduce((a, b) => a + (b.gems || 0), 0);
    const done = Object.keys(save.best).length;
    let total = 0;
    for (const b of Object.values(save.best)) total += b.time || 0;
    els.menuBest.textContent = done >= LEVELS.length ? fmt(total) : '—';

    const next = Math.min(LEVELS.length - 1, Math.max(0, save.unlocked - 1));
    const target = save.best[next] ? Math.min(LEVELS.length - 1, next + 1) : next;
    save.lastIdx = target;
    const lv = LEVELS[target];
    if (totalStars() === maxStars()) {
      els.btnPlay.firstChild.textContent = 'REJOUER';
      els.btnPlaySub.textContent = 'Chasse aux records';
    } else if (save.unlocked > 1) {
      els.btnPlay.firstChild.textContent = 'CONTINUER';
      els.btnPlaySub.textContent = 'Monde ' + String(target + 1).padStart(2, '0') + ' — ' + lv.name;
    } else {
      els.btnPlay.firstChild.textContent = 'JOUER';
      els.btnPlaySub.textContent = 'Nouvelle course';
    }
    els.howto.classList.add('hidden');
    els.btnSound.classList.toggle('off', save.muted);
  }

  /* ---------------------------------------------------------- cartes de monde */
  function buildLevelCards() {
    els.levelGrid.innerHTML = '';
    LEVELS.forEach((L, i) => {
      const locked = i >= save.unlocked;
      const b = save.best[i];
      const card = document.createElement('button');
      card.className = 'lcard';
      card.style.setProperty('--card-accent', L.theme.ui || L.theme.accent);
      card.disabled = locked;
      const cv = document.createElement('canvas');
      cv.width = 300; cv.height = 148;
      drawThumb(cv, L, i);
      card.appendChild(cv);
      const body = document.createElement('div');
      body.className = 'lc-body';
      body.innerHTML =
        '<div class="lc-top"><span class="lc-num">MONDE ' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="lc-sub">' + (b ? fmt(b.time) : 'objectif ' + fmt(L.par)) + '</span></div>' +
        '<div class="lc-name">' + L.name + '</div>' +
        '<div class="lc-stars">' + [0, 1, 2].map(k => '<i class="' + (b && stars(b) > k ? 'on' : '') + '">★</i>').join('') + '</div>';
      card.appendChild(body);
      if (b) {
        const best = document.createElement('span');
        best.className = 'lc-best';
        best.textContent = '★ ' + stars(b);
        card.appendChild(best);
      }
      if (locked) {
        card.classList.add('locked');
        const lock = document.createElement('div');
        lock.className = 'lc-lock';
        lock.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
        card.appendChild(lock);
      }
      card.addEventListener('click', () => {
        if (locked) return;
        Sound.ui();
        startLevelIntro(i);
      });
      els.levelGrid.appendChild(card);
    });
    const st = totalStars(), nd = Object.keys(save.best).length;
    els.levelsSummary.textContent = st + ' étoile' + (st === 1 ? '' : 's') + ' sur ' + maxStars() + ' · ' +
      nd + ' monde' + (nd === 1 ? '' : 's') + ' terminé' + (nd === 1 ? '' : 's') +
      ' · ' + LEVELS.length + ' mondes au total';
  }

  /* ---------------------------------------------------------- skins */
  function isSkinUnlocked(sk) {
    return sk.unlock == null || !!save.best[sk.unlock];
  }

  function buildSkinCards() {
    els.skinGrid.innerHTML = '';
    let owned = 0;
    Render.SKINS.forEach(sk => {
      const unlocked = isSkinUnlocked(sk);
      if (unlocked) owned++;
      const selected = save.skin === sk.id;
      const card = document.createElement('button');
      card.className = 'scard' + (selected ? ' selected' : '') + (unlocked ? '' : ' locked');
      card.style.setProperty('--card-accent', sk.glow.replace(/rgba?\(([^)]+)\)/, (m, args) => {
        const parts = args.split(',').map(s => s.trim());
        return 'rgb(' + parts.slice(0, 3).join(',') + ')';
      }));
      const cv = document.createElement('canvas');
      cv.width = 180; cv.height = 180;
      Render.drawSkinPreview(cv, sk.id);
      card.appendChild(cv);
      const body = document.createElement('div');
      body.className = 'sk-body';
      body.innerHTML =
        '<span class="sk-tag">' + sk.tag + '</span>' +
        '<div class="sk-name">' + sk.name + '</div>';
      card.appendChild(body);
      if (selected) {
        const eq = document.createElement('span');
        eq.className = 'sk-equip';
        eq.textContent = 'ÉQUIPÉ';
        card.appendChild(eq);
      }
      if (!unlocked) {
        card.disabled = true;
        const lock = document.createElement('div');
        lock.className = 'sk-lock';
        lock.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>' +
          '<span>Finis<br>' + LEVELS[sk.unlock].name + '</span>';
        card.appendChild(lock);
      }
      card.addEventListener('click', () => {
        if (!unlocked) {
          toast('Termine « ' + LEVELS[sk.unlock].name + ' » pour débloquer ' + sk.name, 2600);
          Sound.back();
          return;
        }
        save.skin = sk.id;
        Render.setSkin(sk.id);
        writeSave();
        Sound.ui();
        buildSkinCards();
      });
      els.skinGrid.appendChild(card);
    });
    els.skinsSummary.textContent =
      owned + ' skin' + (owned > 1 ? 's' : '') + ' débloqué' + (owned > 1 ? 's' : '') +
      ' sur ' + Render.SKINS.length + ' · termine les mondes animés pour tous les avoir';
  }

  function drawThumb(cv, L, idx) {
    const c = cv.getContext('2d');
    const th = L.theme;
    const sx = 300 / L.width, sy = 148 / VH;
    const g = c.createLinearGradient(0, 0, 0, 148);
    g.addColorStop(0, th.sky[1]); g.addColorStop(0.6, th.sky[2]); g.addColorStop(1, th.sky[3]);
    c.fillStyle = g; c.fillRect(0, 0, 300, 148);
    c.fillStyle = th.far;
    c.beginPath();
    c.moveTo(0, 148);
    for (let x = 0; x <= 300; x += 20) c.lineTo(x, 104 - Math.sin(x * 0.05 + idx) * 12 - Math.cos(x * 0.11) * 6);
    c.lineTo(300, 148); c.closePath(); c.fill();
    c.fillStyle = th.mid;
    L.solids.forEach(s => c.fillRect(s[0] * sx, s[1] * sy, Math.max(1, s[2] * sx), Math.max(2, s[3] * sy)));
    c.fillStyle = th.groundTop;
    L.solids.forEach(s => c.fillRect(s[0] * sx, s[1] * sy, Math.max(1, s[2] * sx), 1.4));
    c.fillStyle = 'rgba(255,255,255,.65)';
    L.plats.forEach(p => c.fillRect(p[0] * sx, p[1] * sy, Math.max(1.5, p[2] * sx), 1.6));
    L.crumbles.forEach(p => { c.fillStyle = 'rgba(255,150,170,.8)'; c.fillRect(p[0] * sx, p[1] * sy, Math.max(1.5, p[2] * sx), 1.6); });
    L.movers.forEach(p => { c.fillStyle = th.accent; c.fillRect(p[0] * sx, p[1] * sy, Math.max(1.5, p[2] * sx), 1.6); });
    // départ & but
    c.fillStyle = '#7cf6ff';
    c.beginPath(); c.arc(L.start[0] * sx, L.start[1] * sy - 4, 2.6, 0, 6.283); c.fill();
    c.fillStyle = th.glow;
    c.beginPath(); c.arc(L.goal[0] * sx, L.goal[1] * sy - 5, 3.4, 0, 6.283); c.fill();
    c.globalAlpha = 0.25;
    c.fillStyle = th.glow;
    c.fillRect(0, 0, 300, 148);
    c.globalAlpha = 1;
  }

  /* ---------------------------------------------------------- lancer un niveau */
  function startLevelIntro(i) {
    Engine.loadLevel(i);
    save.lastIdx = i; writeSave();
    applyTheme();
    els.introNum.textContent = String(i + 1).padStart(2, '0');
    els.introName.textContent = LEVELS[i].name;
    els.introSub.textContent = LEVELS[i].subtitle;
    els.introHints.innerHTML = LEVELS[i].hints.map(h => '<li>' + h + '</li>').join('');
    Game.screen = 'intro';
    showScreen('intro');
    Sound.setMood(i);
  }

  function beginPlay() {
    Sound.unlock();
    Engine.beginRun();
    Game.screen = 'play';
    showScreen(null);
    Input.reset();
    hideToast();
  }

  function togglePause() {
    if (Game.screen === 'play') {
      Game.screen = 'pause';
      showScreen('pause');
      Input.reset();
      Sound.ui();
    } else if (Game.screen === 'pause') {
      Game.screen = 'play';
      showScreen(null);
      Input.reset();
      Sound.ui();
    }
  }

  function restartLevel() {
    Engine.beginRun();
    Game.screen = 'play';
    showScreen(null);
    Input.reset();
  }

  /* ---------------------------------------------------------- fin de niveau */
  function onComplete(r) {
    starsTimers.forEach(clearTimeout); starsTimers = [];
    els.completeBadge.textContent = 'MONDE ' + String(r.idx + 1).padStart(2, '0');
    els.completeName.textContent = r.name;
    els.statTime.textContent = fmtMs(r.time);
    els.statCoins.textContent = r.coins + '/' + r.totalCoins;
    els.statGems.textContent = r.gems + '/' + r.totalGems;
    els.statDeaths.textContent = r.deaths;
    els.completeStars.querySelectorAll('span').forEach(s => s.classList.remove('on'));

    const prev = save.best[r.idx];
    const isRecord = !prev || r.time < prev.time || r.stars > prev.stars;
    els.recordBadge.classList.toggle('hidden', !isRecord);

    if (isRecord) {
      save.best[r.idx] = {
        stars: Math.max(r.stars, prev ? prev.stars : 0),
        time: Math.min(r.time, prev ? prev.time : Infinity),
        coins: Math.max(r.coins, prev ? prev.coins : 0),
        gems: Math.max(r.gems, prev ? prev.gems : 0),
        deaths: Math.min(r.deaths, prev ? prev.deaths : 999),
      };
    }
    save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, r.idx + 2));
    writeSave();

    showScreen('complete');
    const starEls = els.completeStars.querySelectorAll('span');
    for (let i = 0; i < r.stars; i++) {
      starsTimers.push(setTimeout(() => {
        starEls[i].classList.add('on');
        Sound.star(i);
      }, 260 + i * 240));
    }
    els.btnNext.textContent = r.idx >= LEVELS.length - 1 ? '' : '';
    els.btnNext.innerHTML = (r.idx >= LEVELS.length - 1 ? 'LE FINAL' : 'SUIVANT') + ' <span class="kbd">Espace</span>';
  }

  function nextLevel() {
    if (!Game.result) return;
    if (Game.result.idx >= LEVELS.length - 1) showEnding();
    else startLevelIntro(Game.result.idx + 1);
  }

  function showEnding() {
    Game.screen = 'ending';
    const vals = Object.values(save.best);
    const totTime = vals.reduce((a, b) => a + (b.time || 0), 0);
    els.endStars.textContent = totalStars() + '/' + maxStars();
    els.endTime.textContent = fmt(totTime);
    els.endCoins.textContent = vals.reduce((a, b) => a + (b.coins || 0), 0);
    els.endGems.textContent = vals.reduce((a, b) => a + (b.gems || 0), 0);
    els.endDeaths.textContent = vals.reduce((a, b) => a + (b.deaths || 0), 0);
    if (els.endingSub) els.endingSub.textContent = 'Tu as traversé les ' + LEVELS.length + ' mondes. La lueur est sauve.';
    const quotes = [
      '« Cours vite, brille fort. »',
      '« La nuit n\'a rien vu venir. »',
      '« ' + LEVELS.length + ' mondes, une seule lueur. »',
    ];
    els.endingQuote.textContent = quotes[Math.floor(Math.random() * quotes.length)];
    showScreen('ending');
    Sound.win();
    for (let i = 0; i < 90; i++) {
      part({
        x: rnd(0, VW), y: rnd(-VH * 0.5, 0), vx: rnd(-70, 70), vy: rnd(60, 220),
        life: rnd(1.6, 3.2), max: 3.2, size: rnd(3, 7),
        color: ['#ffd85c', '#5ef0ff', '#ff5d8f', '#b8ff9a', '#c9a0ff'][i % 5],
        grav: 40, drag: 1, type: 'square', rot: Math.random() * 6, vr: rnd(-6, 6),
      });
    }
  }

  /* ---------------------------------------------------------- toast */
  function toast(text, ms = 2800) {
    if (toastTimer) { toastQueue.push([text, ms]); return; }
    els.toast.textContent = text;
    els.toast.classList.remove('hidden');
    els.toast.style.animation = 'none';
    void els.toast.offsetWidth;
    els.toast.style.animation = '';
    toastTimer = setTimeout(() => {
      els.toast.classList.add('hidden');
      toastTimer = null;
      if (toastQueue.length) { const n = toastQueue.shift(); toast(n[0], n[1]); }
    }, ms);
  }
  function hideToast() {
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = null; toastQueue.length = 0;
    els.toast.classList.add('hidden');
  }

  /* ---------------------------------------------------------- entrées */
  function isTouch() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }

  function keyName(e) {
    const k = e.key;
    return k.length === 1 ? k.toLowerCase() : k;
  }

  function onKeyDown(e) {
    const k = keyName(e);
    Sound.unlock();
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Spacebar'].includes(e.key)) e.preventDefault();

    if (k === 'm') { toggleMute(); return; }
    if (k === '`') { Render.toggleDebug(); return; }

    if (k === 'Escape' || k === 'p') {
      if (Game.screen === 'play' || Game.screen === 'pause') { togglePause(); return; }
      if (Game.screen === 'levels' || Game.screen === 'skins' || Game.screen === 'intro') { Sound.back(); Game.screen = 'menu'; showScreen('menu'); return; }
      if (Game.screen === 'complete') { Sound.back(); Game.screen = 'levels'; showScreen('levels'); return; }
    }
    if (k === 'r' && (Game.screen === 'play' || Game.screen === 'pause')) { restartLevel(); return; }

    if (Game.screen === 'menu' && (k === ' ' || k === 'Enter')) { startLevelIntro(save.lastIdx); return; }
    if (Game.screen === 'intro' && (k === ' ' || k === 'Enter')) { beginPlay(); return; }
    if (Game.screen === 'complete' && (k === ' ' || k === 'Enter')) { nextLevel(); return; }
    if (Game.screen === 'ending' && (k === ' ' || k === 'Enter')) { startLevelIntro(0); return; }

    // jeu
    if (k === 'ArrowLeft' || k === 'q' || k === 'a') keys.left = true;
    if (k === 'ArrowRight' || k === 'd') keys.right = true;
    if (k === 'ArrowDown' || k === 's') keys.down = true;
    if (k === ' ' || k === 'ArrowUp' || k === 'z' || k === 'w' || k === 'k') { keys.jump = true; }
    if (e.key === 'Shift' || k === 'e' || k === 'x' || k === 'l') keys.dash = true;
  }

  function onKeyUp(e) {
    const k = keyName(e);
    if (k === 'ArrowLeft' || k === 'q' || k === 'a') keys.left = false;
    if (k === 'ArrowRight' || k === 'd') keys.right = false;
    if (k === 'ArrowDown' || k === 's') keys.down = false;
    if (k === ' ' || k === 'ArrowUp' || k === 'z' || k === 'w' || k === 'k') keys.jump = false;
    if (e.key === 'Shift' || k === 'e' || k === 'x' || k === 'l') keys.dash = false;
  }

  function pollGamepad() {
    pad.left = pad.right = pad.jump = pad.dash = pad.down = false;
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of list) {
      if (!gp) continue;
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      const b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
      if (ax < -0.35 || b(14)) pad.left = true;
      if (ax > 0.35 || b(15)) pad.right = true;
      if (ay > 0.5 || b(13)) pad.down = true;
      if (b(0) || b(1) || b(12)) pad.jump = true;
      if (b(2) || b(3) || b(5) || b(7)) pad.dash = true;
      if (b(9)) {
        if (!pad.ok) { pad.ok = true; if (Game.screen === 'play') togglePause(); else if (Game.screen === 'pause') togglePause(); }
      } else pad.ok = false;
      break;
    }
  }

  function composeInput() {
    Input.left = !!keys.left || pad.left || touch.left;
    Input.right = !!keys.right || pad.right || touch.right;
    Input.down = !!keys.down || pad.down;
    Input.jump = !!keys.jump || pad.jump || touch.jump || touch.pendingJump;
    Input.jumpHeld = Input.jump;
    Input.dash = !!keys.dash || pad.dash || touch.dash || touch.pendingDash;
    Input.syncEdges();
    // un appui très bref est quand même pris en compte pendant une frame
    touch.pendingJump = false; touch.pendingDash = false;
  }

  function bindTouch() {
    els.touch.querySelectorAll('.tbtn').forEach(btn => {
      const k = btn.dataset.k;
      const on = (e) => {
        e.preventDefault();
        Sound.unlock();
        touch[k] = true;
        if (k === 'jump') touch.pendingJump = true;
        if (k === 'dash') touch.pendingDash = true;
        btn.classList.add('pressed');
        if (btn.setPointerCapture && e.pointerId != null) { try { btn.setPointerCapture(e.pointerId); } catch (err) {} }
      };
      const off = (e) => {
        touch[k] = false;
        btn.classList.remove('pressed');
      };
      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off);
      btn.addEventListener('pointerleave', off);
      // filet de sécurité pour les navigateurs qui n'émettent pas d'événements pointer
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); on(e); }, { passive: false });
      btn.addEventListener('touchend', (e) => { e.preventDefault(); off(e); }, { passive: false });
      btn.addEventListener('touchcancel', (e) => { e.preventDefault(); off(e); }, { passive: false });
      btn.addEventListener('contextmenu', e => e.preventDefault());
    });
  }

  function toggleMute() {
    save.muted = !save.muted;
    Sound.setMusic(!save.muted && save.music);
    Sound.setSfx(!save.muted && save.sfx);
    els.btnSound.classList.toggle('off', save.muted);
    els.optMusic.checked = save.music && !save.muted;
    els.optSfx.checked = save.sfx && !save.muted;
    writeSave();
    if (!save.muted) Sound.ui();
  }

  /* ---------------------------------------------------------- HUD */
  let hudCache = {};
  function tickHud() {
    if (!Game.level) return;
    if (hudCache.level !== Game.idx) {
      hudCache.level = Game.idx;
      els.hudLevelNum.textContent = String(Game.idx + 1).padStart(2, '0');
      els.hudLevelName.textContent = Game.level.def.name;
      els.hudCoinsTotal.textContent = Game.level.coins.length;
      els.hudGemsTotal.textContent = Game.level.gems.length;
    }
    const t = fmt(Game.run.time);
    if (hudCache.time !== t) { hudCache.time = t; els.hudTime.textContent = t; }
    if (hudCache.coins !== Game.run.coins) { hudCache.coins = Game.run.coins; els.hudCoins.textContent = Game.run.coins; }
    if (hudCache.gems !== Game.run.gems) { hudCache.gems = Game.run.gems; els.hudGems.textContent = Game.run.gems; }
    if (hudCache.deaths !== Game.run.deaths) { hudCache.deaths = Game.run.deaths; els.hudDeaths.textContent = Game.run.deaths; }
    // progression
    const p = Game.player;
    if (p && Game.level) {
      const pct = Math.max(0, Math.min(1, p.x / (Game.level.goal.x - 20)));
      const v = (pct * 100).toFixed(2) + '%';
      if (hudCache.pct !== v) { hudCache.pct = v; els.progressFill.style.width = v; els.progressDot.style.left = v; }
    }
    const low = Game.level.def.par && Game.run.time > Game.level.def.par;
    els.timePill.classList.toggle('ghost', false);
    els.hudTime.style.color = low ? 'var(--dim)' : '';
  }

  /* ---------------------------------------------------------- boucle */
  let last = 0, acc = 0;
  const STEP = 1 / 60;
  let fpsAcc = 0, fpsFrames = 0, slowTime = 0, qualityLevel = 1;
  const QUALITY_STEPS = [1, 0.8, 0.62];

  function frame(now) {
    if (!last) last = now;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    pollGamepad();
    composeInput();

    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard++ < 4) { Engine.tick(STEP); acc -= STEP; }
    if (guard >= 4) acc = 0;

    // surveillance du framerate : dégradation progressive si nécessaire
    fpsAcc += dt; fpsFrames++;
    if (fpsAcc > 1.2) {
      const fps = fpsFrames / fpsAcc;
      if (fps < 46 && Game.screen === 'play') {
        slowTime += fpsAcc;
        if (slowTime > 1.5 && qualityLevel < QUALITY_STEPS.length - 1) {
          qualityLevel++;
          Render.setQuality(QUALITY_STEPS[qualityLevel]);
          slowTime = 0;
        }
      } else slowTime = 0;
      fpsAcc = 0; fpsFrames = 0;
    }

    drainEvents();
    Render.draw();
    tickHud();
    Sound.tick();
    requestAnimationFrame(frame);
  }

  function drainEvents() {
    while (Game.events.length) {
      const ev = Game.events.shift();
      if (ev.type === 'hint') toast(HINTS[ev.key] || '', 3200);
      else if (ev.type === 'checkpoint') toast('Point de contrôle activé', 1800);
      else if (ev.type === 'complete') onComplete(ev);
      else if (ev.type === 'death' && Game.run.deaths === 1) toast('Oups ! Tu réapparais au dernier point de contrôle.', 2600);
    }
  }

  /* ---------------------------------------------------------- init */
  function cacheEls() {
    const ids = [
      'frame', 'hud', 'touch', 'toast', 'loading',
      'menuStars', 'menuStarsLabel', 'menuBest', 'menuGems', 'btnPlay', 'btnPlaySub',
      'btnLevels', 'btnSkins', 'btnHow', 'btnReset', 'logoSub',
      'howto', 'btnSound', 'btnPause', 'levelGrid', 'levelsSummary', 'btnLevelsBack',
      'skinGrid', 'skinsSummary', 'btnSkinsBack', 'endingSub',
      'introNum', 'introName', 'introSub', 'introHints', 'btnStart',
      'btnResume', 'btnRestart', 'btnPauseLevels', 'btnPauseMenu', 'optMusic', 'optSfx',
      'completeBadge', 'completeName', 'completeStars', 'statTime', 'statCoins', 'statGems', 'statDeaths',
      'recordBadge', 'btnNext', 'btnReplay', 'btnCompleteLevels',
      'endStars', 'endTime', 'endCoins', 'endGems', 'endDeaths', 'endingQuote', 'btnEndReplay', 'btnEndLevels',
      'hudLevelNum', 'hudLevelName', 'hudTime', 'hudCoins', 'hudCoinsTotal', 'hudGems', 'hudGemsTotal',
      'hudDeaths', 'timePill', 'deathPill', 'progress', 'progressFill', 'progressDot',
      'scr-menu', 'scr-levels', 'scr-skins', 'scr-intro', 'scr-pause', 'scr-complete', 'scr-ending',
    ];
    ids.forEach(id => { els[id] = document.getElementById(id); });
    els.levelChip = document.getElementById('levelChip');
  }

  function bind() {
    els.btnPlay.addEventListener('click', () => { Sound.unlock(); Sound.ui(); startLevelIntro(save.lastIdx); });
    els.btnLevels.addEventListener('click', () => { Sound.unlock(); Sound.ui(); Game.screen = 'levels'; showScreen('levels'); });
    els.btnSkins.addEventListener('click', () => { Sound.unlock(); Sound.ui(); Game.screen = 'skins'; showScreen('skins'); });
    els.btnSkinsBack.addEventListener('click', () => { Sound.back(); Game.screen = 'menu'; showScreen('menu'); });
    els.btnHow.addEventListener('click', () => { Sound.ui(); els.howto.classList.toggle('hidden'); });
    els.btnReset.addEventListener('click', () => {
      if (!resetArmed) {
        resetArmed = true;
        els.btnReset.textContent = 'CONFIRMER ?';
        els.btnReset.classList.add('danger');
        setTimeout(() => { resetArmed = false; els.btnReset.textContent = 'EFFACER'; els.btnReset.classList.remove('danger'); }, 3200);
        Sound.ui();
      } else {
        save = { unlocked: 1, lastIdx: 0, best: {}, music: save.music, sfx: save.sfx, muted: save.muted, skin: 'nova' };
        writeSave();
        Render.setSkin('nova');
        refreshMenu(); buildLevelCards();
        els.btnReset.textContent = 'EFFACER'; els.btnReset.classList.remove('danger'); resetArmed = false;
        Sound.back();
      }
    });
    els.btnLevelsBack.addEventListener('click', () => { Sound.back(); Game.screen = 'menu'; showScreen('menu'); });
    els.btnStart.addEventListener('click', beginPlay);
    els.btnPause.addEventListener('click', togglePause);
    els.btnSound.addEventListener('click', toggleMute);
    els.btnResume.addEventListener('click', togglePause);
    els.btnRestart.addEventListener('click', restartLevel);
    els.btnPauseLevels.addEventListener('click', () => { Sound.back(); Game.screen = 'levels'; showScreen('levels'); });
    els.btnPauseMenu.addEventListener('click', () => { Sound.back(); Game.screen = 'menu'; showScreen('menu'); });
    els.btnNext.addEventListener('click', nextLevel);
    els.btnReplay.addEventListener('click', () => { Sound.ui(); startLevelIntro(Game.idx); });
    els.btnCompleteLevels.addEventListener('click', () => { Sound.back(); Game.screen = 'levels'; showScreen('levels'); });
    els.btnEndReplay.addEventListener('click', () => { Sound.ui(); startLevelIntro(0); });
    els.btnEndLevels.addEventListener('click', () => { Sound.back(); Game.screen = 'levels'; showScreen('levels'); });

    els.optMusic.checked = save.music && !save.muted;
    els.optSfx.checked = save.sfx && !save.muted;
    els.optMusic.addEventListener('change', () => {
      save.music = els.optMusic.checked; Sound.setMusic(save.music && !save.muted); writeSave();
    });
    els.optSfx.addEventListener('change', () => {
      save.sfx = els.optSfx.checked; Sound.setSfx(save.sfx && !save.muted); writeSave(); Sound.ui();
    });

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', () => { keys.left = keys.right = keys.down = keys.jump = keys.dash = false; });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && Game.screen === 'play') togglePause();
    });
    // déverrouillage audio au premier geste
    const unlock = () => Sound.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    bindTouch();

    window.addEventListener('resize', resizeUi);
  }

  function resizeUi() {
    const r = els.frame.getBoundingClientRect();
    const s = Math.max(0.6, Math.min(2.4, r.width / 1280));
    els.frame.style.setProperty('--s', s.toFixed(4));
    const portrait = window.innerHeight > window.innerWidth * 1.08 && isTouch();
    document.body.classList.toggle('portrait', portrait);
  }

  function init() {
    loadSave();
    cacheEls();
    resizeUi();
    Render.init();
    bind();
    Render.setSkin(save.skin || 'nova');
    Sound.setMusic(save.music && !save.muted);
    Sound.setSfx(save.sfx && !save.muted);
    els.btnSound.classList.toggle('off', save.muted);

    Engine.loadLevel(0);
    Game.screen = 'menu';
    applyTheme();
    showScreen('menu');

    // première frame
    requestAnimationFrame((t) => {
      last = t;
      requestAnimationFrame(frame);
      setTimeout(() => els.loading.classList.add('gone'), 120);
      setTimeout(() => els.loading.remove(), 700);
    });

    window.addEventListener('resize', resizeUi);
  }

  return { init, showScreen, toast };
})();

window.addEventListener('DOMContentLoaded', () => UI.init());
if (document.readyState !== 'loading') UI.init();
