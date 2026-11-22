// ===================== NEVELKROON — canvas-renderer =====================

const STEP_MS = 650;
const MONSTER_COLOR = '#ff5d5d';
const CRISIS_COLOR = '#ff2fb0';
const PIRATE_COLOR = '#ff9a3d';

const R = {
  canvas: null, ctx: null, dpr: 1, W: 0, H: 0,
  cam: { x: 0, y: 0, z: 0.6 }, target: null,
  bg: null, bgFor: null, terr: null, terrKey: '', terrPad: 260,
  starLayers: [], glow: {}, time: 0,
  anim: null, fx: [], hits: [], selSys: null, selFleet: null, hoverSys: null,
  viewer: 0, demo: false, onAnimDone: null,
};

function rInit(canvas) {
  R.canvas = canvas;
  R.ctx = canvas.getContext('2d');
  rResize();
  window.addEventListener('resize', rResize);
  for (let l = 0; l < 3; l++) {
    const pts = [];
    const n = [220, 120, 50][l];
    for (let i = 0; i < n; i++) pts.push({ x: Math.random() * 1400, y: Math.random() * 1400, r: Math.random() * (0.6 + l * 0.5) + 0.3, a: 0.25 + Math.random() * 0.6, tw: Math.random() * 6 });
    R.starLayers.push(pts);
  }
}
function rResize() {
  R.dpr = Math.min(2, window.devicePixelRatio || 1);
  R.W = R.canvas.clientWidth; R.H = R.canvas.clientHeight;
  R.canvas.width = Math.round(R.W * R.dpr); R.canvas.height = Math.round(R.H * R.dpr);
}
const w2s = (x, y) => [(x - R.cam.x) * R.cam.z + R.W / 2, (y - R.cam.y) * R.cam.z + R.H / 2];
const s2w = (x, y) => [(x - R.W / 2) / R.cam.z + R.cam.x, (y - R.H / 2) / R.cam.z + R.cam.y];

function glowSprite(color, size) {
  const k = color + size;
  if (R.glow[k]) return R.glow[k];
  const c = document.createElement('canvas');
  c.width = c.height = size * 2;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size, size, 0, size, size, size);
  gr.addColorStop(0, color);
  gr.addColorStop(0.18, hexA(color, 0.55));
  gr.addColorStop(0.45, hexA(color, 0.12));
  gr.addColorStop(1, hexA(color, 0));
  g.fillStyle = gr; g.fillRect(0, 0, size * 2, size * 2);
  R.glow[k] = c;
  return c;
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
function mixHex(a, b, t) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
  return '#' + ((1 << 24) + (ch(16) << 16) + (ch(8) << 8) + ch(0)).toString(16).slice(1);
}

// ---------- Background nebula ----------
function rBuildBackground(G) {
  const pad = 700, sc = 0.35;
  const W = Math.round((G.w + pad * 2) * sc), H = Math.round((G.h + pad * 2) * sc);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#03040a'; g.fillRect(0, 0, W, H);
  let seed = G.seed || 7;
  const rr = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const pal = ['#4b2386', '#123f7a', '#7a1f5c', '#0e5a55', '#2a2f8a', '#6a2a1a'];
  g.globalCompositeOperation = 'lighter';
  const cx = W / 2, cy = H / 2;
  // core glow
  let gr = g.createRadialGradient(cx, cy, 0, cx, cy, W * 0.35);
  gr.addColorStop(0, 'rgba(255,214,170,0.22)'); gr.addColorStop(0.3, 'rgba(160,90,200,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) {
    const r = Math.sqrt(rr()) * 0.48, th = rr() * Math.PI * 2;
    const arm = th + r * 3.2;
    const x = cx + Math.cos(arm) * r * W * 0.9 + (rr() - 0.5) * 60;
    const y = cy + Math.sin(arm) * r * H * 0.9 + (rr() - 0.5) * 60;
    const rad = 40 + rr() * 170;
    const col = pal[Math.floor(rr() * pal.length)];
    gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, hexA(col, 0.10 + rr() * 0.12)); gr.addColorStop(1, hexA(col, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 30; i++) {
    const x = rr() * W, y = rr() * H, rad = 30 + rr() * 120;
    gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(2,2,6,0.35)'); gr.addColorStop(1, 'rgba(2,2,6,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 2600; i++) {
    const r = Math.pow(rr(), 0.7) * 0.5, th = rr() * Math.PI * 2;
    const arm = th + r * 3.2;
    const x = cx + Math.cos(arm) * r * W * 0.95, y = cy + Math.sin(arm) * r * H * 0.95;
    g.fillStyle = `rgba(255,${200 + Math.floor(rr() * 55)},${180 + Math.floor(rr() * 75)},${0.15 + rr() * 0.5})`;
    g.fillRect(x, y, rr() < 0.1 ? 1.5 : 0.8, rr() < 0.1 ? 1.5 : 0.8);
  }
  R.bg = { c, pad, sc };
  R.bgFor = G.seed;
}

// ---------- Territory ----------
function rTerritoryKey(G) {
  const v = G.empires[R.viewer];
  let k = '';
  for (const s of G.systems) k += (R.viewer < 0 || (v && v.known[s.id])) ? (s.owner == null ? '.' : s.owner) : '?';
  return k;
}
function rBuildTerritory(G) {
  const key = rTerritoryKey(G);
  if (key === R.terrKey && R.terr) return;
  R.terrKey = key;
  const cell = 5, pad = R.terrPad, rad = 165, bw = 16;
  const gw = Math.ceil((G.w + pad * 2) / cell), gh = Math.ceil((G.h + pad * 2) / cell);
  const sys = G.systems.filter((s, i) => key[i] !== '?');
  const own = sys.map(s => s.owner == null ? -1 : s.owner);
  const c = document.createElement('canvas'); c.width = gw; c.height = gh;
  const g = c.getContext('2d');
  const img = g.createImageData(gw, gh);
  const cols = G.empires.map(e => { const n = parseInt(e.color.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; });
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const x = i * cell - pad, y = j * cell - pad;
    let b1 = -1, d1 = Infinity;
    for (let k = 0; k < sys.length; k++) { const d = (sys[k].x - x) ** 2 + (sys[k].y - y) ** 2; if (d < d1) { d1 = d; b1 = k; } }
    if (b1 < 0 || own[b1] < 0) continue;
    const o = own[b1];
    const dd1 = Math.sqrt(d1);
    let m = rad - dd1;
    if (m <= -bw) continue;
    const s1 = sys[b1];
    for (let k = 0; k < sys.length; k++) {
      if (own[k] === o) continue;
      const s2 = sys[k];
      const sep = Math.hypot(s2.x - s1.x, s2.y - s1.y);
      if (sep > 2 * rad + 40) continue;
      const d2 = (s2.x - x) ** 2 + (s2.y - y) ** 2;
      const bis = (d2 - d1) / (2 * sep);
      if (bis < m) m = bis;
    }
    if (m < -1) continue;
    const edge = Math.max(0, 1 - m / bw);
    const p = (j * gw + i) * 4;
    const [r, gg, b] = cols[o];
    img.data[p] = r; img.data[p + 1] = gg; img.data[p + 2] = b;
    img.data[p + 3] = Math.round(34 + 200 * edge * edge * (m < 0 ? Math.max(0, 1 + m) : 1));
  }
  g.putImageData(img, 0, 0);
  R.terr = { c, cell, pad };
}

// ---------- Fleet placement ----------
function fleetVisible(G, f) {
  if (R.viewer < 0) return true;
  const v = G.empires[R.viewer];
  return f.emp === R.viewer || !!v.vis[f.sys];
}
function fleetSlots(G) {
  // returns map fleetId -> {x,y,angle}
  const bySys = {};
  for (const f of G.fleets) { if (!fleetVisible(G, f)) continue; (bySys[f.sys] = bySys[f.sys] || []).push(f); }
  const out = {};
  for (const sid in bySys) {
    const s = G.systems[sid];
    const list = bySys[sid].sort((a, b) => (a.emp - b.emp) || (a.id - b.id));
    const n = list.length;
    list.forEach((f, i) => {
      const ang = -Math.PI * 0.75 + (i - (n - 1) / 2) * Math.min(0.55, 2.4 / n);
      const rad = 26 + (n > 6 ? (i % 2) * 9 : 0);
      out[f.id] = { x: s.x + Math.cos(ang) * rad, y: s.y + Math.sin(ang) * rad, a: -0.6 };
    });
  }
  return out;
}
function fleetColor(G, f) { return f.emp === -1 ? (['piratenbasis', 'rovers', 'piraten'].includes(f.monster) ? PIRATE_COLOR : MONSTER_COLOR) : f.emp === -2 ? CRISIS_COLOR : G.empires[f.emp].color; }
function fleetGlyph(G, f) {
  if (f.emp === -1) return f.monster === 'piratenbasis' ? 'pbase' : (f.monster === 'piraten' || f.monster === 'rovers') ? 'claw' : 'monster';
  if (f.emp === -2) return f.rift ? 'rift' : 'void';
  if (fleetIsCiv(f)) return 'civ_' + f.ships[0].t;
  return faction(G.empires[f.emp]).ship;
}

function drawGlyph(g, kind, x, y, s, ang, col, t) {
  g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = col; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = s * 0.12;
  g.beginPath();
  switch (kind) {
    case 'arrow': g.moveTo(s, 0); g.lineTo(-s * 0.7, s * 0.6); g.lineTo(-s * 0.35, 0); g.lineTo(-s * 0.7, -s * 0.6); break;
    case 'claw': g.moveTo(s, 0); g.lineTo(0, s * 0.8); g.lineTo(-s * 0.2, s * 0.3); g.lineTo(-s * 0.8, s * 0.5); g.lineTo(-s * 0.5, 0); g.lineTo(-s * 0.8, -s * 0.5); g.lineTo(-s * 0.2, -s * 0.3); g.lineTo(0, -s * 0.8); break;
    case 'crystal': g.moveTo(s * 1.1, 0); g.lineTo(0, s * 0.5); g.lineTo(-s * 0.9, 0); g.lineTo(0, -s * 0.5); break;
    case 'disc': g.ellipse(0, 0, s * 0.9, s * 0.55, 0, 0, Math.PI * 2); g.moveTo(s * 1.1, 0); g.arc(s * 0.6, 0, s * 0.25, 0, Math.PI * 2); break;
    case 'blade': g.moveTo(s * 1.2, 0); g.lineTo(-s * 0.4, s * 0.35); g.lineTo(-s * 0.8, s * 0.8); g.lineTo(-s * 0.6, 0); g.lineTo(-s * 0.8, -s * 0.8); g.lineTo(-s * 0.4, -s * 0.35); break;
    case 'monster': for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + t; const r = i % 2 ? s * 0.45 : s; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } break;
    case 'void': for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 - t * 1.5; const r = s * (0.6 + 0.4 * Math.sin(t * 3 + i)); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } break;
    case 'pbase': for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + t * 0.2; g.lineTo(Math.cos(a) * s, Math.sin(a) * s); } g.closePath(); g.moveTo(s * 0.45, 0); g.arc(0, 0, s * 0.45, 0, Math.PI * 2, true); break;
    case 'rift': g.ellipse(0, 0, s * 0.5, s * 1.4, t * 0.3, 0, Math.PI * 2); break;
    case 'civ_verkenner': g.arc(0, 0, s * 0.45, 0, Math.PI * 2); g.moveTo(s * 0.9, 0); g.lineTo(s * 0.3, s * 0.2); g.lineTo(s * 0.3, -s * 0.2); break;
    case 'civ_bouwschip': g.rect(-s * 0.5, -s * 0.5, s, s); break;
    case 'civ_kolonie': g.moveTo(0, -s * 0.7); g.lineTo(s * 0.6, 0); g.lineTo(0, s * 0.7); g.lineTo(-s * 0.6, 0); break;
    default: g.arc(0, 0, s * 0.6, 0, Math.PI * 2);
  }
  g.closePath(); g.fill(); g.stroke();
  g.restore();
}

// ---------- Animation ----------
function rStartAnim(G, anim) {
  const t0 = performance.now();
  const steps = anim.moves.reduce((m, mv) => Math.max(m, mv.step + 1), 0);
  const v = R.viewer >= 0 ? G.empires[R.viewer] : null;
  const seen = (sid) => !v || v.vis[sid];
  const moves = anim.moves.filter(m => seen(m.from) || seen(m.to) || m.emp === R.viewer);
  const combatStart = t0 + steps * STEP_MS;
  R.anim = { t0, moves, steps, end: combatStart + (anim.combats.length ? 1500 : 0) };
  for (const c of anim.combats) {
    if (!seen(c.sys)) continue;
    const s = G.systems[c.sys];
    const cols = c.parties.map(p => p === -1 ? MONSTER_COLOR : p === -2 ? CRISIS_COLOR : G.empires[p].color);
    const n = Math.min(26, 6 + c.shots);
    for (let i = 0; i < n; i++) {
      const a = Math.floor(Math.random() * cols.length);
      const b = (a + 1) % cols.length;
      const ang1 = Math.random() * Math.PI * 2, ang2 = ang1 + Math.PI + (Math.random() - 0.5);
      R.fx.push({ type: 'laser', t0: combatStart + Math.random() * 1200, dur: 260, col: cols[a],
        x1: s.x + Math.cos(ang1) * (20 + Math.random() * 16), y1: s.y + Math.sin(ang1) * (20 + Math.random() * 16),
        x2: s.x + Math.cos(ang2) * (14 + Math.random() * 16), y2: s.y + Math.sin(ang2) * (14 + Math.random() * 16), snd: i % 3 === 0, col2: cols[b] });
    }
  }
  for (const b of anim.booms) {
    if (!seen(b.sys)) continue;
    const s = G.systems[b.sys];
    rBoom(s.x + (Math.random() - 0.5) * 40, s.y + (Math.random() - 0.5) * 40, 6 + b.big * 5, combatStart + 300 + Math.random() * 1100);
  }
}
function rBoom(x, y, size, t0) {
  const parts = [];
  for (let i = 0; i < 14 + size; i++) { const a = Math.random() * Math.PI * 2, sp = (0.3 + Math.random()) * size * 2.2; parts.push({ vx: Math.cos(a) * sp, vy: Math.sin(a) * sp }); }
  R.fx.push({ type: 'boom', x, y, size, t0, dur: 900, parts, snd: true });
}
function rPulse(x, y, col) { R.fx.push({ type: 'pulse', x, y, col, t0: performance.now(), dur: 1400 }); }
function animPos(G, f, slots, now) {
  const base = slots[f.id];
  if (!R.anim || now >= R.anim.end) return base;
  const mv = R.anim.moves.filter(m => m.id === f.id);
  if (!mv.length) return base;
  const k = Math.floor((now - R.anim.t0) / STEP_MS);
  if (k >= R.anim.steps || k > mv[mv.length - 1].step) return base;
  const cur = mv.find(m => m.step === k) || (k < mv[0].step ? null : mv[mv.length - 1]);
  const first = mv[0];
  if (!cur) { const s = G.systems[first.from]; return { x: s.x, y: s.y - 24, a: Math.atan2(G.systems[first.to].y - s.y, G.systems[first.to].x - s.x) }; }
  const t = Math.min(1, (now - R.anim.t0 - cur.step * STEP_MS) / STEP_MS);
  const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const a = G.systems[cur.from], b = G.systems[cur.to];
  return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e - 18, a: Math.atan2(b.y - a.y, b.x - a.x) };
}
function rAnimating() { return R.anim && performance.now() < R.anim.end; }

// ---------- Main draw ----------
function rDraw(G, now) {
  const g = R.ctx, dpr = R.dpr, z = R.cam.z;
  R.time = now / 1000;
  if (R.target) {
    R.cam.x += (R.target.x - R.cam.x) * 0.12; R.cam.y += (R.target.y - R.cam.y) * 0.12;
    if (R.target.z) R.cam.z += (R.target.z - R.cam.z) * 0.12;
    if (Math.abs(R.target.x - R.cam.x) < 1 && Math.abs(R.target.y - R.cam.y) < 1) R.target = null;
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#02030a'; g.fillRect(0, 0, R.W, R.H);
  if (!G) return;
  if (R.bgFor !== G.seed) rBuildBackground(G);
  // nebula (parallax 0.8)
  const bz = z * 0.85 + 0.15;
  const B = R.bg;
  g.globalAlpha = 1;
  const bx0 = (-B.pad - R.cam.x * 0.8 - G.w / 2 * 0.2) * bz + R.W / 2;
  const by0 = (-B.pad - R.cam.y * 0.8 - G.h / 2 * 0.2) * bz + R.H / 2;
  g.drawImage(B.c, bx0, by0, (G.w + B.pad * 2) * bz, (G.h + B.pad * 2) * bz);
  // starfield
  for (let l = 0; l < 3; l++) {
    const par = [0.05, 0.12, 0.25][l];
    const ox = -R.cam.x * par * z, oy = -R.cam.y * par * z;
    for (const p of R.starLayers[l]) {
      const x = ((p.x + ox) % 1400 + 1400) % 1400 * (R.W / 1400 + 0.2), y = ((p.y + oy) % 1400 + 1400) % 1400 * (R.H / 1400 + 0.2);
      if (x > R.W || y > R.H) continue;
      g.globalAlpha = p.a * (0.7 + 0.3 * Math.sin(R.time * 1.3 + p.tw));
      g.fillStyle = '#dfe8ff';
      g.fillRect(x, y, p.r, p.r);
    }
  }
  g.globalAlpha = 1;
  // world transform
  g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (R.W / 2 - R.cam.x * z), dpr * (R.H / 2 - R.cam.y * z));
  const v = R.viewer >= 0 ? G.empires[R.viewer] : null;
  const known = (sid) => !v || v.known[sid];
  const visible = (sid) => !v || v.vis[sid];
  // territory
  rBuildTerritory(G);
  g.imageSmoothingEnabled = true;
  g.globalAlpha = 0.9;
  g.drawImage(R.terr.c, -R.terr.pad, -R.terr.pad, R.terr.c.width * R.terr.cell, R.terr.c.height * R.terr.cell);
  g.globalAlpha = 1;
  // lanes
  g.lineWidth = 1.3 / z;
  for (const [a, b] of G.lanes) {
    if (!known(a) || !known(b)) continue;
    const A = G.systems[a], Bs = G.systems[b];
    const sameOwner = A.owner != null && A.owner === Bs.owner;
    g.strokeStyle = sameOwner ? hexA(G.empires[A.owner].color, 0.45) : 'rgba(150,175,230,0.22)';
    g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(Bs.x, Bs.y); g.stroke();
  }
  // selected fleet path
  const selF = R.selFleet != null ? G.fleets.find(f => f.id === R.selFleet) : null;
  if (selF && selF.path.length) {
    g.setLineDash([8 / z, 6 / z]); g.lineDashOffset = -R.time * 30 / z;
    g.strokeStyle = 'rgba(140,255,200,0.9)'; g.lineWidth = 2.4 / z;
    g.beginPath(); let p = G.systems[selF.sys]; g.moveTo(p.x, p.y);
    for (const sid of selF.path) { p = G.systems[sid]; g.lineTo(p.x, p.y); }
    g.stroke(); g.setLineDash([]);
  }
  // systems
  const t = R.time;
  for (const s of G.systems) {
    if (!known(s.id)) continue;
    const vis = visible(s.id);
    const ST = D.STAR_TYPES[s.star];
    const [sx, sy] = w2s(s.x, s.y);
    if (sx < -80 || sy < -80 || sx > R.W + 80 || sy > R.H + 80) continue;
    g.globalAlpha = vis ? 1 : 0.55;
    if (s.relay) {
      g.save(); g.translate(s.x, s.y);
      g.strokeStyle = 'rgba(120,240,255,0.75)'; g.lineWidth = 1.6 / z;
      for (let i = 0; i < 3; i++) { g.rotate(t * (0.3 + i * 0.2) * (i % 2 ? -1 : 1)); g.beginPath(); g.ellipse(0, 0, 30 + i * 6, 11 + i * 3, 0, 0, Math.PI * 2); g.stroke(); }
      g.restore();
      const gs = glowSprite('#66f0ff', 64); g.globalAlpha *= 0.4 + 0.2 * Math.sin(t * 2); g.drawImage(gs, s.x - 64, s.y - 64); g.globalAlpha = vis ? 1 : 0.55;
    }
    if (s.blight) { const gs = glowSprite('#ff2fb0', 50); g.globalAlpha *= 0.5; g.drawImage(gs, s.x - 50, s.y - 50); g.globalAlpha = vis ? 1 : 0.55; }
    if (s.star === 'gat') {
      g.save(); g.translate(s.x, s.y); g.rotate(t * 0.6);
      const gr = g.createRadialGradient(0, 0, 4, 0, 0, 22);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.35, 'rgba(255,170,90,0.9)'); gr.addColorStop(0.55, 'rgba(180,80,255,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 24, 9, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, 6, 0, Math.PI * 2); g.fill();
      g.restore();
    } else {
      const gsz = ST.r * 5;
      const sp = glowSprite(ST.color, Math.round(gsz));
      const pul = 1 + 0.06 * Math.sin(t * 2 + s.id);
      g.drawImage(sp, s.x - gsz * pul, s.y - gsz * pul, gsz * 2 * pul, gsz * 2 * pul);
      g.fillStyle = mixHex(ST.color, '#ffffff', 0.6);
      g.beginPath(); g.arc(s.x, s.y, ST.r * 0.45, 0, Math.PI * 2); g.fill();
    }
    // planets when zoomed in & surveyed
    if (z > 1.15 && (!v || v.known[s.id] === 2)) {
      for (const p of s.planets) {
        const pa = p.phase + t * (8 / p.orbit) * 0.4;
        const pr = p.orbit * 0.85;
        g.strokeStyle = 'rgba(160,180,255,0.10)'; g.lineWidth = 0.8 / z;
        g.beginPath(); g.arc(s.x, s.y, pr, 0, Math.PI * 2); g.stroke();
        const px = s.x + Math.cos(pa) * pr, py = s.y + Math.sin(pa) * pr * 0.95;
        const PT = D.PLANET_TYPES[p.type];
        const prad = 1.6 + p.size * 0.22;
        const gr = g.createRadialGradient(px - prad * 0.4, py - prad * 0.4, 0, px, py, prad);
        gr.addColorStop(0, PT.color); gr.addColorStop(1, PT.color2);
        g.fillStyle = gr; g.beginPath(); g.arc(px, py, prad, 0, Math.PI * 2); g.fill();
        if (p.colony) { const c = G.colonies.find(x => x.id === p.colony); if (c) { g.strokeStyle = G.empires[c.emp].color; g.lineWidth = 1.2 / z; g.beginPath(); g.arc(px, py, prad + 2.5, 0, Math.PI * 2); g.stroke(); } }
      }
    }
    // owner ring / starbase
    if (s.owner != null) {
      const col = G.empires[s.owner].color;
      g.strokeStyle = col; g.lineWidth = (s.starbase.level >= 2 ? 2.6 : 1.4) / z;
      g.beginPath(); g.arc(s.x, s.y, 14 + s.starbase.level * 1.5, 0, Math.PI * 2); g.stroke();
      if (s.starbase.level >= 2) {
        g.save(); g.translate(s.x, s.y); g.rotate(t * 0.4);
        g.fillStyle = col;
        for (let i = 0; i < (s.starbase.level === 3 ? 6 : 4); i++) { g.rotate(Math.PI * 2 / (s.starbase.level === 3 ? 6 : 4)); g.fillRect(16 + s.starbase.level, -1.5, 4, 3); }
        g.restore();
      }
      if (s.siege) {
        g.strokeStyle = 'rgba(255,60,60,' + (0.5 + 0.5 * Math.sin(t * 6)) + ')'; g.lineWidth = 2.5 / z;
        g.beginPath(); g.arc(s.x, s.y, 22, 0, Math.PI * 2 * (s.siege.t / (s.siege.need || 3))); g.stroke();
      }
    }
    g.globalAlpha = 1;
  }
  // selection ring
  if (R.selSys != null) {
    const s = G.systems[R.selSys];
    g.save(); g.translate(s.x, s.y); g.rotate(t * 0.8);
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.8 / z;
    g.setLineDash([6 / z, 5 / z]); g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    g.restore();
  }
  // fleets
  const slots = fleetSlots(G);
  R.hits = [];
  for (const f of G.fleets) {
    if (!slots[f.id]) continue;
    const p = animPos(G, f, slots, now);
    const col = fleetColor(G, f);
    const civ = fleetIsCiv(f);
    const pw = civ ? 0 : fleetPower(G, f);
    const sz = civ ? 5 : Math.min(14, 6 + Math.log2(1 + pw / 15) * 1.6);
    const moving = f.path && f.path.length;
    let ang = p.a;
    if (!rAnimating() && moving) { const nx = G.systems[f.path[0]]; ang = Math.atan2(nx.y - p.y, nx.x - p.x); }
    if (f.id === R.selFleet) { g.strokeStyle = '#8cffc8'; g.lineWidth = 1.6 / z; g.beginPath(); g.arc(p.x, p.y, sz + 5, 0, Math.PI * 2); g.stroke(); }
    const gl = glowSprite(col, 24); g.globalAlpha = 0.45; g.drawImage(gl, p.x - sz * 2.2, p.y - sz * 2.2, sz * 4.4, sz * 4.4); g.globalAlpha = 1;
    drawGlyph(g, fleetGlyph(G, f), p.x, p.y, sz, ang, col, t);
    const [hx, hy] = w2s(p.x, p.y);
    R.hits.push({ id: f.id, x: hx, y: hy, r: Math.max(14, sz * z + 6), emp: f.emp });
  }
  // effects
  for (const fx of R.fx) {
    const k = (now - fx.t0) / fx.dur;
    if (k < 0 || k > 1) continue;
    if (fx.type === 'laser') {
      if (fx.snd && !fx.played) { fx.played = true; if (typeof AudioFX !== 'undefined') AudioFX.sfx('laser'); }
      g.strokeStyle = fx.col; g.globalAlpha = 1 - k; g.lineWidth = 2.2 / z;
      g.beginPath(); g.moveTo(fx.x1, fx.y1); g.lineTo(fx.x1 + (fx.x2 - fx.x1) * Math.min(1, k * 3), fx.y1 + (fx.y2 - fx.y1) * Math.min(1, k * 3)); g.stroke();
      g.globalAlpha = 1;
    } else if (fx.type === 'boom') {
      if (fx.snd && !fx.played) { fx.played = true; if (typeof AudioFX !== 'undefined') AudioFX.sfx('boom'); }
      const gs = glowSprite('#ffb060', 40);
      g.globalAlpha = (1 - k) * 0.9; const r = fx.size * (0.6 + k * 1.6);
      g.drawImage(gs, fx.x - r * 2, fx.y - r * 2, r * 4, r * 4);
      g.fillStyle = '#fff3c0';
      for (const pp of fx.parts) g.fillRect(fx.x + pp.vx * k, fx.y + pp.vy * k, 1.6 / z + 0.6, 1.6 / z + 0.6);
      g.globalAlpha = 1;
    } else if (fx.type === 'pulse') {
      g.strokeStyle = fx.col; g.globalAlpha = 1 - k; g.lineWidth = 3 / z;
      g.beginPath(); g.arc(fx.x, fx.y, 14 + k * 70, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
    }
  }
  R.fx = R.fx.filter(fx => now < fx.t0 + fx.dur);
  // labels (screen space)
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (z > 0.42) {
    g.textAlign = 'center'; g.textBaseline = 'top';
    const fs = Math.round(Math.min(14, 9 + z * 3.5));
    g.font = `600 ${fs}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
    for (const s of G.systems) {
      if (!known(s.id)) continue;
      const [sx, sy] = w2s(s.x, s.y);
      if (sx < -60 || sy < -60 || sx > R.W + 60 || sy > R.H + 60) continue;
      const ly = sy + 18 * Math.max(0.8, z) + 2;
      const col = s.owner != null ? mixHex(G.empires[s.owner].color, '#ffffff', 0.35) : (visible(s.id) ? '#c9d3ee' : '#7d87a6');
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(s.name, sx + 1, ly + 1);
      g.fillStyle = col; g.fillText(s.name, sx, ly);
      let badges = '';
      const cols = G.colonies.filter(c => c.sys === s.id);
      if (cols.length) badges += '● ' + cols.reduce((a, c) => a + Math.floor(c.pop), 0);
      if (s.relay) badges += (badges ? '  ' : '') + '✧ Relais';
      if (s.anomaly && v && v.known[s.id] === 2) badges += (badges ? '  ' : '') + '? Anomalie';
      if (s.feats && s.feats.length && (!v || v.known[s.id] === 2)) badges += (badges ? '  ' : '') + '◆';
      if (badges) {
        g.font = `500 ${fs - 2}px system-ui, sans-serif`;
        g.fillStyle = s.relay ? '#8ff3ff' : (s.anomaly && v && v.known[s.id] === 2) ? '#ffd65a' : '#e8ecf8';
        g.fillText(badges, sx, ly + fs + 2);
        g.font = `600 ${fs}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
      }
    }
    // fleet power labels
    if (z > 0.75) {
      g.font = `700 ${fs - 3}px system-ui, sans-serif`;
      for (const h of R.hits) {
        const f = G.fleets.find(x => x.id === h.id);
        if (!f || fleetIsCiv(f)) continue;
        const pw = Math.round(fleetPower(G, f));
        g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillText(pw, h.x + 1, h.y + h.r * 0.55 + 1);
        g.fillStyle = mixHex(fleetColor(G, f), '#ffffff', 0.4); g.fillText(pw, h.x, h.y + h.r * 0.55);
      }
    }
  }
  if (R.anim && now >= R.anim.end) { R.anim = null; if (R.onAnimDone) { const cb = R.onAnimDone; R.onAnimDone = null; cb(); } }
}

function rPickSystem(G, sx, sy) {
  const [wx, wy] = s2w(sx, sy);
  const v = R.viewer >= 0 ? G.empires[R.viewer] : null;
  let best = null, bd = (34 / R.cam.z) ** 2 + 400;
  for (const s of G.systems) {
    if (v && !v.known[s.id]) continue;
    const d = (s.x - wx) ** 2 + (s.y - wy) ** 2;
    if (d < bd) { bd = d; best = s.id; }
  }
  return best;
}
function rPickFleet(sx, sy, onlyEmp) {
  let best = null, bd = Infinity;
  for (const h of R.hits) {
    if (onlyEmp != null && h.emp !== onlyEmp) continue;
    const d = (h.x - sx) ** 2 + (h.y - sy) ** 2;
    if (d < h.r * h.r && d < bd) { bd = d; best = h.id; }
  }
  return best;
}
function rFocus(x, y, z) { R.target = { x, y, z: z || null }; }
