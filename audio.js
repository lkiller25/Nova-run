/* ============================================================
   NOVA RUN — audio 100 % synthèse (WebAudio), aucune ressource externe
   ============================================================ */
const Sound = (function () {
  let ctx = null, master = null, musicBus = null, sfxBus = null, comp = null;
  let musicOn = true, sfxOn = true, ok = false;
  let nextStepTime = 0, step = 0, mood = 0, tempo = 112;
  let noiseBuf = null;

  const SCALE = [0, 2, 3, 5, 7, 8, 10]; // mineure naturelle
  const CHORDS = [0, 3, 7, 10];          // Am7 – Fmaj7 – Cmaj7 – G7 (degrés)
  const CHORD_SEMIS = [[0, 3, 7, 12], [8, 12, 15, 19], [3, 7, 10, 15], [-2, 2, 5, 10]];

  function ensure() {
    if (ok) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 22; comp.ratio.value = 3.2;
      comp.attack.value = 0.004; comp.release.value = 0.22;
      master = ctx.createGain(); master.gain.value = 0.9;
      musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.22 : 0;
      sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 0.55 : 0;
      musicBus.connect(comp); sfxBus.connect(comp); comp.connect(master); master.connect(ctx.destination);
      // bruit blanc réutilisable
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      ok = true;
      nextStepTime = ctx.currentTime + 0.08;
    } catch (e) { ok = false; }
    return ok;
  }

  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
  }

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  function tone(o) {
    if (!ok || (o.bus === 'music' ? !musicOn : !sfxOn)) return;
    const t0 = (o.when || ctx.currentTime) + (o.delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t0 + (o.dur || 0.2));
    const vol = o.vol == null ? 0.2 : o.vol;
    const atk = o.atk == null ? 0.006 : o.atk;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (o.dur || 0.2));
    let node = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter; f.frequency.setValueAtTime(o.filterFreq || 1200, t0);
      if (o.filterTo) f.frequency.exponentialRampToValueAtTime(o.filterTo, t0 + (o.dur || 0.2));
      f.Q.value = o.q || 1;
      node.connect(f); node = f;
    }
    node.connect(g);
    g.connect(o.bus === 'music' ? musicBus : sfxBus);
    osc.start(t0); osc.stop(t0 + (o.dur || 0.2) + 0.05);
  }

  function noise(o) {
    if (!ok || (o.bus === 'music' ? !musicOn : !sfxOn)) return;
    const t0 = (o.when || ctx.currentTime) + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'highpass';
    f.frequency.setValueAtTime(o.freq || 3000, t0);
    if (o.freqTo) f.frequency.exponentialRampToValueAtTime(o.freqTo, t0 + (o.dur || 0.1));
    f.Q.value = o.q || 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.1, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (o.dur || 0.1));
    src.connect(f); f.connect(g); g.connect(o.bus === 'music' ? musicBus : sfxBus);
    src.start(t0); src.stop(t0 + (o.dur || 0.1) + 0.02);
  }

  /* ------------------------------------------------ bruitages */
  const api = {
    unlock, ensure,
    get ready() { return ok; },
    setMusic(on) { musicOn = on; if (musicBus) musicBus.gain.value = on ? 0.22 : 0; },
    setSfx(on) { sfxOn = on; if (sfxBus) sfxBus.gain.value = on ? 0.55 : 0; },
    setMood(m) { mood = [0, 2, -1, 3, -4, 1, -2, 4][m] ?? 0; },
    jump() {
      tone({ type: 'triangle', freq: 340, slide: 640, dur: 0.13, vol: 0.22 });
      noise({ dur: 0.06, vol: 0.05, filter: 'highpass', freq: 2400 });
    },
    doubleJump() {
      tone({ type: 'square', freq: 520, slide: 980, dur: 0.13, vol: 0.13, filter: 'lowpass', filterFreq: 3200 });
      tone({ type: 'sine', freq: 1320, slide: 1760, dur: 0.16, vol: 0.09, delay: 0.03 });
    },
    wallJump() {
      tone({ type: 'triangle', freq: 300, slide: 560, dur: 0.12, vol: 0.18 });
      noise({ dur: 0.07, vol: 0.06, filter: 'bandpass', freq: 900, q: 2 });
    },
    dash() {
      noise({ dur: 0.19, vol: 0.16, filter: 'bandpass', freq: 2600, freqTo: 420, q: 1.6 });
      tone({ type: 'sawtooth', freq: 240, slide: 90, dur: 0.18, vol: 0.08, filter: 'lowpass', filterFreq: 900 });
    },
    land(hard) {
      noise({ dur: 0.07, vol: hard ? 0.1 : 0.05, filter: 'lowpass', freq: 900, freqTo: 240 });
      tone({ type: 'sine', freq: 150, slide: 70, dur: 0.09, vol: hard ? 0.12 : 0.06 });
    },
    coin(combo) {
      const n = 84 + Math.min(12, combo || 0) * 2;
      tone({ type: 'triangle', freq: midi(n), dur: 0.07, vol: 0.16 });
      tone({ type: 'sine', freq: midi(n + 7), dur: 0.13, vol: 0.11, delay: 0.045 });
    },
    gem() {
      [0, 4, 7, 12].forEach((s, i) => tone({ type: 'triangle', freq: midi(84 + s), dur: 0.2, vol: 0.13, delay: i * 0.055 }));
      tone({ type: 'sine', freq: midi(96), dur: 0.5, vol: 0.07, delay: 0.2 });
    },
    spring() {
      tone({ type: 'triangle', freq: 180, slide: 1100, dur: 0.26, vol: 0.2 });
      tone({ type: 'sine', freq: 520, slide: 1500, dur: 0.22, vol: 0.1, delay: 0.02 });
    },
    stomp() {
      tone({ type: 'square', freq: 420, slide: 120, dur: 0.14, vol: 0.14, filter: 'lowpass', filterFreq: 1800 });
      noise({ dur: 0.09, vol: 0.1, filter: 'bandpass', freq: 1600 });
    },
    death() {
      tone({ type: 'sawtooth', freq: 320, slide: 45, dur: 0.55, vol: 0.2, filter: 'lowpass', filterFreq: 1400, filterTo: 200 });
      noise({ dur: 0.35, vol: 0.12, filter: 'lowpass', freq: 2400, freqTo: 180 });
    },
    checkpoint() {
      [72, 79, 84].forEach((n, i) => tone({ type: 'sine', freq: midi(n), dur: 0.42, vol: 0.12, delay: i * 0.09 }));
    },
    win() {
      [72, 76, 79, 84, 88, 91].forEach((n, i) =>
        tone({ type: 'triangle', freq: midi(n), dur: 0.5, vol: 0.15, delay: i * 0.1 }));
      [60, 64, 67, 72].forEach(n => tone({ type: 'sine', freq: midi(n), dur: 1.6, vol: 0.07, delay: 0.6 }));
    },
    star(i) {
      tone({ type: 'sine', freq: midi(88 + i * 4), dur: 0.5, vol: 0.12 });
      tone({ type: 'sine', freq: midi(95 + i * 4), dur: 0.7, vol: 0.06, delay: 0.05 });
    },
    ui() { tone({ type: 'square', freq: 720, dur: 0.05, vol: 0.05, filter: 'lowpass', filterFreq: 2600 }); },
    back() { tone({ type: 'square', freq: 480, slide: 300, dur: 0.08, vol: 0.05, filter: 'lowpass', filterFreq: 2000 }); },
    rumble() {
      noise({ dur: 1.4, vol: 0.09, filter: 'lowpass', freq: 400, freqTo: 90 });
      tone({ type: 'sine', freq: 70, slide: 40, dur: 1.6, vol: 0.12 });
    },

    /* ------------------------------------------------ musique */
    tick() {
      if (!ok || ctx.state !== 'running' || !musicOn) return;
      const now = ctx.currentTime;
      if (nextStepTime < now - 0.5) nextStepTime = now + 0.05; // reprise après onglet inactif
      const stepDur = 60 / tempo / 2;
      while (nextStepTime < now + 0.16) {
        scheduleStep(step, nextStepTime, stepDur);
        step = (step + 1) % 64;
        nextStepTime += stepDur;
      }
    },
  };

  function scheduleStep(s, t, dur) {
    const bar = Math.floor(s / 16) % 4;
    const beat = s % 16;
    const chord = CHORD_SEMIS[bar];
    const root = 33 + mood * 2 + chord[0]; // basse
    // basse
    if (beat === 0 || beat === 6 || beat === 10) {
      tone({ bus: 'music', when: t, type: 'triangle', freq: midi(root), dur: dur * 1.6, vol: 0.5, atk: 0.01 });
      tone({ bus: 'music', when: t, type: 'sine', freq: midi(root - 12), dur: dur * 1.4, vol: 0.3, atk: 0.01 });
    }
    // arpège
    const arpOrder = [0, 1, 2, 3, 2, 1, 3, 2];
    const note = 60 + mood * 2 + chord[arpOrder[beat % 8]] + (bar === 2 && beat > 11 ? 12 : 0);
    if (beat % 2 === 0) {
      tone({ bus: 'music', when: t, type: 'triangle', freq: midi(note), dur: dur * 0.9, vol: 0.16, atk: 0.005,
        filter: 'lowpass', filterFreq: 5200 });
    }
    // nappe haute discrète
    if (beat === 0) {
      tone({ bus: 'music', when: t, type: 'sine', freq: midi(note + 12), dur: dur * 12, vol: 0.05, atk: dur * 2 });
    }
    // percu
    if (beat === 0 || beat === 8) {
      tone({ bus: 'music', when: t, type: 'sine', freq: 130, slide: 48, dur: 0.16, vol: 0.5 });
    }
    if (beat % 4 === 2) noise({ bus: 'music', when: t, dur: 0.05, vol: 0.12, filter: 'highpass', freq: 6800 });
    if (beat % 8 === 4) noise({ bus: 'music', when: t, dur: 0.12, vol: 0.1, filter: 'bandpass', freq: 1800, q: 1.2 });
    // clochette mélodique
    if ((s % 32) === 20 || (s % 32) === 26) {
      tone({ bus: 'music', when: t, type: 'sine', freq: midi(84 + mood * 2 + CHORD_SEMIS[bar][1]), dur: 0.6, vol: 0.12, atk: 0.01 });
    }
  }

  return api;
})();
