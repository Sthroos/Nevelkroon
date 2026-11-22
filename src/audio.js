// ===================== NEVELKROON — generatieve muziek en geluidseffecten (WebAudio) =====================

const AudioFX = (() => {
  let ctx = null, master, musicBus, sfxBus, reverb, delay, delayFb;
  let musicTimer = null, nextChordAt = 0, nextBellAt = 0, nextBeatAt = 0, chordIdx = 0;
  const vol = { music: 0.55, sfx: 0.75 };
  let intensity = 0; // 0 calm .. 1 war/crisis
  const lastSfx = {};

  const CALM = [[0, 7, 12, 15, 19], [-4, 3, 8, 12, 15], [-7, 0, 5, 9, 12], [-2, 5, 10, 14, 17]];
  const TENSE = [[0, 7, 12, 15, 18], [1, 8, 13, 16, 20], [-2, 5, 10, 13, 17], [-5, 2, 7, 10, 14]];
  const ROOT = 110; // A2
  const hz = (semi) => ROOT * Math.pow(2, semi / 12);

  function impulse(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    reverb = ctx.createConvolver(); reverb.buffer = impulse(3.4, 2.6);
    const revGain = ctx.createGain(); revGain.gain.value = 0.55;
    reverb.connect(revGain); revGain.connect(master);
    delay = ctx.createDelay(2); delay.delayTime.value = 0.48;
    delayFb = ctx.createGain(); delayFb.gain.value = 0.38;
    delay.connect(delayFb); delayFb.connect(delay); delay.connect(reverb);
    musicBus = ctx.createGain(); musicBus.gain.value = vol.music * 0.5;
    musicBus.connect(master); musicBus.connect(reverb);
    sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx;
    sfxBus.connect(master);
    const send = ctx.createGain(); send.gain.value = 0.25; sfxBus.connect(send); send.connect(reverb);
  }

  // ---------- Music ----------
  function pad(freqs, t, dur) {
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 3;
    filt.frequency.setValueAtTime(380, t);
    filt.frequency.linearRampToValueAtTime(900 + intensity * 700, t + dur * 0.5);
    filt.frequency.linearRampToValueAtTime(420, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.07, t + 2.8);
    g.gain.setValueAtTime(0.07, t + dur - 2.5);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.5);
    filt.connect(g); g.connect(musicBus);
    for (const f of freqs) for (const det of [-7, 6]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      o.connect(filt); o.start(t); o.stop(t + dur + 1.6);
    }
    // sub bass
    const b = ctx.createOscillator(); b.type = 'sine'; b.frequency.value = freqs[0] / 2;
    const bg = ctx.createGain(); bg.gain.setValueAtTime(0.0001, t); bg.gain.linearRampToValueAtTime(0.12, t + 3); bg.gain.linearRampToValueAtTime(0.0001, t + dur + 1);
    b.connect(bg); bg.connect(musicBus); b.start(t); b.stop(t + dur + 1.2);
  }
  function bell(freq, t, amp) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    g.connect(musicBus); g.connect(delay);
    for (const [mul, a] of [[1, 1], [2.01, 0.35], [3.98, 0.12]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * mul;
      const og = ctx.createGain(); og.gain.value = a;
      o.connect(og); og.connect(g); o.start(t); o.stop(t + 2.7);
    }
  }
  function drum(t) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.35 * intensity, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.5);
  }
  function tick() {
    if (!ctx) return;
    const now = ctx.currentTime;
    const ahead = now + 0.6;
    const prog = intensity > 0.5 ? TENSE : CALM;
    const chordDur = 9.6;
    while (nextChordAt < ahead) {
      const ch = prog[chordIdx % prog.length];
      pad(ch.slice(0, 4).map(s => hz(s)), nextChordAt, chordDur);
      chordIdx++;
      nextChordAt += chordDur;
    }
    while (nextBellAt < ahead) {
      const ch = prog[(chordIdx - 1 + prog.length) % prog.length];
      const semi = ch[Math.floor(Math.random() * ch.length)] + 24 + (Math.random() < 0.3 ? 12 : 0);
      bell(hz(semi), nextBellAt, 0.05 + Math.random() * 0.04);
      nextBellAt += [0.6, 1.2, 1.8, 2.4][Math.floor(Math.random() * 4)];
    }
    while (nextBeatAt < ahead) {
      if (intensity > 0.45) drum(nextBeatAt);
      nextBeatAt += 60 / 72;
    }
  }
  function startMusic() {
    init();
    if (!ctx || musicTimer) return;
    nextChordAt = nextBellAt = nextBeatAt = ctx.currentTime + 0.2;
    musicTimer = setInterval(tick, 200);
  }

  // ---------- SFX ----------
  function env(node, t, a, dur, peak) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(type, f1, f2, dur, peak, t0) {
    const t = t0 || ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f1, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain(); env(g, t, 0.005, dur, peak);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, f, q, peak, t0, type) {
    const t = t0 || ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const fl = ctx.createBiquadFilter(); fl.type = type || 'bandpass'; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); env(g, t, 0.01, dur, peak);
    src.connect(fl); fl.connect(g); g.connect(sfxBus); src.start(t);
    return fl;
  }
  const SFX = {
    click: () => tone('sine', 880, 660, 0.06, 0.12),
    select: () => { tone('triangle', 520, null, 0.08, 0.12); tone('triangle', 780, null, 0.1, 0.1, ctx.currentTime + 0.05); },
    move: () => { tone('sine', 300, 600, 0.18, 0.12); },
    error: () => { tone('square', 180, 120, 0.18, 0.06); },
    turn: () => { const f = noise(0.9, 400, 0.8, 0.18); f.frequency.exponentialRampToValueAtTime(3000, ctx.currentTime + 0.8); tone('sine', 220, 440, 0.6, 0.08); },
    build: () => { tone('triangle', 392, null, 0.15, 0.12); tone('triangle', 587, null, 0.25, 0.1, ctx.currentTime + 0.1); },
    research: () => { const t = ctx.currentTime; [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, null, 0.5, 0.1, t + i * 0.09)); },
    colony: () => { const t = ctx.currentTime; [392, 494, 587, 784].forEach((f, i) => tone('sine', f, null, 1.0, 0.09, t + i * 0.12)); },
    war: () => { const t = ctx.currentTime; tone('sawtooth', 110, 98, 1.2, 0.14, t); tone('sawtooth', 165, 147, 1.2, 0.1, t); noise(0.5, 120, 1, 0.3, t, 'lowpass'); },
    peace: () => { const t = ctx.currentTime; [440, 554, 659].forEach((f, i) => tone('sine', f, null, 1.4, 0.08, t + i * 0.15)); },
    laser: () => tone('sawtooth', 1500 + Math.random() * 600, 220, 0.16, 0.05),
    boom: () => { noise(0.8, 160, 0.7, 0.35, null, 'lowpass'); tone('sine', 90, 30, 0.6, 0.2); },
    alert: () => { const t = ctx.currentTime; for (let i = 0; i < 3; i++) tone('square', 520, 380, 0.22, 0.05, t + i * 0.28); },
    crisis: () => { const t = ctx.currentTime; tone('sawtooth', 55, 40, 3, 0.2, t); tone('sawtooth', 58.3, 41, 3, 0.15, t); noise(3, 80, 2, 0.25, t, 'lowpass'); },
    victory: () => { const t = ctx.currentTime; [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, null, 1.6, 0.1, t + i * 0.18)); },
    defeat: () => { const t = ctx.currentTime; [392, 349, 311, 262].forEach((f, i) => tone('sine', f, null, 1.4, 0.1, t + i * 0.35)); },
    event: () => { const t = ctx.currentTime; tone('sine', 660, null, 0.6, 0.08, t); tone('sine', 990, null, 0.8, 0.06, t + 0.15); },
  };
  function sfx(name) {
    if (!ctx || vol.sfx <= 0 || !SFX[name]) return;
    const now = performance.now();
    if (lastSfx[name] && now - lastSfx[name] < (name === 'laser' ? 60 : 90)) return;
    lastSfx[name] = now;
    SFX[name]();
  }
  function setVolume(kind, v) {
    vol[kind] = v;
    if (!ctx) return;
    if (kind === 'music') musicBus.gain.setTargetAtTime(v * 0.5, ctx.currentTime, 0.3);
    else sfxBus.gain.setTargetAtTime(v, ctx.currentTime, 0.1);
  }
  function setIntensity(v) { intensity = Math.max(0, Math.min(1, v)); }
  return { init, startMusic, sfx, setVolume, setIntensity, vol };
})();
