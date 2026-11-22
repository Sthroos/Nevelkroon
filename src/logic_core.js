// ===================== NEVELKROON — kernlogica (geen DOM) =====================
'use strict';
const D = DATA;

// ---------- Deterministic RNG (mulberry32), state lives in G.rng ----------
function rnd(G) {
  G.rng = (G.rng + 0x6D2B79F5) | 0;
  let t = G.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rint = (G, a, b) => a + Math.floor(rnd(G) * (b - a + 1));
const pick = (G, arr) => arr[Math.floor(rnd(G) * arr.length)];
function shuffle(G, arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd(G) * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
function wpick(G, items, wfn) {
  let tot = 0; for (const it of items) tot += Math.max(0, wfn(it));
  if (tot <= 0) return null;
  let r = rnd(G) * tot;
  for (const it of items) { r -= Math.max(0, wfn(it)); if (r <= 0) return it; }
  return items[items.length - 1];
}

class GameError extends Error {}
const fail = (msg) => { throw new GameError(msg); };

// ---------- Geometry ----------
function segCross(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  if (a === c || a === d || b === c || b === d) return false;
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}
function distPointSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------- Graph helpers ----------
function bfsDist(G, from) {
  const d = new Array(G.systems.length).fill(Infinity);
  const q = [from]; d[from] = 0;
  for (let i = 0; i < q.length; i++) {
    const s = q[i];
    for (const n of G.systems[s].lanes) if (d[n] === Infinity) { d[n] = d[s] + 1; q.push(n); }
  }
  return d;
}
function multiBfs(G, sources) {
  const d = new Array(G.systems.length).fill(Infinity);
  const q = [];
  for (const s of sources) { d[s] = 0; q.push(s); }
  for (let i = 0; i < q.length; i++) {
    const s = q[i];
    for (const n of G.systems[s].lanes) if (d[n] === Infinity) { d[n] = d[s] + 1; q.push(n); }
  }
  return d;
}
/** Shortest path (by jumps) excluding start. `avoid(sysId)` blocks intermediate nodes. Returns null if unreachable. */
function findPath(G, from, to, avoid) {
  if (from === to) return [];
  const prev = new Array(G.systems.length).fill(-1);
  prev[from] = from;
  const q = [from];
  for (let i = 0; i < q.length; i++) {
    const s = q[i];
    for (const n of G.systems[s].lanes) {
      if (prev[n] !== -1) continue;
      if (n !== to && avoid && avoid(n)) continue;
      prev[n] = s;
      if (n === to) {
        const path = [to];
        let c = s;
        while (c !== from) { path.unshift(c); c = prev[c]; }
        return path;
      }
      q.push(n);
    }
  }
  return null;
}
function isConnected(G) {
  const d = bfsDist(G, 0);
  return d.every(x => x < Infinity);
}

// ---------- Names ----------
function makeName(G, used) {
  for (let i = 0; i < 200; i++) {
    const n = pick(G, D.NAME_A) + pick(G, D.NAME_B) + (rnd(G) < 0.18 ? pick(G, D.NAME_C) : '');
    if (!used.has(n)) { used.add(n); return n; }
  }
  const n = 'Stelsel ' + used.size; used.add(n); return n;
}

// ---------- Galaxy generation ----------
function generateGalaxy(G, sizeKey) {
  const cfg = D.GALAXY_SIZES[sizeKey];
  if (!cfg) fail('Onbekende stelselgrootte');
  const { n, w, h } = cfg;
  G.w = w; G.h = h;
  const cx = w / 2, cy = h / 2;
  let minD = Math.sqrt(w * h / n) * 0.66;
  const pts = [];
  let attempts = 0;
  while (pts.length < n) {
    attempts++;
    if (attempts % 4000 === 0) minD *= 0.93;
    const r = Math.sqrt(rnd(G));
    if (r < 0.1) continue;
    const th = rnd(G) * Math.PI * 2;
    const arm = Math.cos(2 * (th - r * 3.2));
    if (rnd(G) > 0.4 + 0.6 * (arm + 1) / 2) continue;
    const p = { x: cx + r * Math.cos(th) * w * 0.46, y: cy + r * Math.sin(th) * h * 0.46 };
    if (pts.some(q => dist(p, q) < minD)) continue;
    pts.push(p);
  }
  const used = new Set();
  G.systems = pts.map((p, i) => ({
    id: i, x: Math.round(p.x), y: Math.round(p.y), name: makeName(G, used),
    star: 'geel', planets: [], lanes: [], owner: null, starbase: { level: 0, hp: 0 },
    dep: { E: 0, M: 0, R: 0 }, anomaly: false, relay: false, siege: null, blight: false,
  }));
  buildLanes(G, minD);
  for (const s of G.systems) populateSystem(G, s);
}

function buildLanes(G, minD) {
  const S = G.systems;
  const cand = [];
  for (let i = 0; i < S.length; i++) {
    const near = S.map((s, j) => [j, dist(S[i], s)]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 5);
    for (const [j, dd] of near) if (dd < minD * 2.4 && i < j) cand.push([i, j, dd]);
    for (const [j, dd] of near) if (dd < minD * 2.4 && j < i) cand.push([j, i, dd]);
  }
  const seen = new Set();
  const edges = [];
  cand.sort((a, b) => a[2] - b[2]);
  const ok = (i, j) => {
    for (const [a, b] of edges) if (segCross(S[i], S[j], S[a], S[b])) return false;
    for (const s of S) if (s.id !== i && s.id !== j && distPointSeg(s, S[i], S[j]) < minD * 0.28) return false;
    return true;
  };
  const add = (i, j) => { edges.push([i, j]); S[i].lanes.push(j); S[j].lanes.push(i); seen.add(i + '-' + j); };
  for (const [i, j] of cand) {
    if (seen.has(i + '-' + j)) continue;
    if (S[i].lanes.length >= 5 || S[j].lanes.length >= 5) continue;
    if (ok(i, j)) add(i, j);
  }
  // connect components
  for (let guard = 0; guard < 200 && !isConnected(G); guard++) {
    const d = bfsDist(G, 0);
    let best = null;
    for (let i = 0; i < S.length; i++) for (let j = 0; j < S.length; j++) {
      if (d[i] === Infinity || d[j] !== Infinity) continue;
      const dd = dist(S[i], S[j]);
      const pen = ok(i, j) ? 0 : 1e6;
      if (!best || dd + pen < best[2]) best = [i, j, dd + pen];
    }
    add(Math.min(best[0], best[1]), Math.max(best[0], best[1]));
  }
  // prune for chokepoints
  shuffle(G, edges);
  for (let k = edges.length - 1; k >= 0; k--) {
    const [a, b] = edges[k];
    if (S[a].lanes.length < 3 || S[b].lanes.length < 3 || rnd(G) > 0.3) continue;
    S[a].lanes = S[a].lanes.filter(x => x !== b); S[b].lanes = S[b].lanes.filter(x => x !== a);
    if (!isConnected(G)) { S[a].lanes.push(b); S[b].lanes.push(a); } else edges.splice(k, 1);
  }
  G.lanes = edges.map(([a, b]) => [a, b]);
}

const PLANET_WEIGHTS = { kaal: 22, gas: 15, asteroid: 10, lava: 8, aards: 4, oceaan: 6, woestijn: 7, toendra: 6, ijs: 7, gaia: 0.6 };
function populateSystem(G, s) {
  const st = wpick(G, Object.keys(D.STAR_TYPES), k => D.STAR_TYPES[k].weight);
  s.star = st;
  const np = rint(G, 1, 5);
  s.planets = [];
  for (let i = 0; i < np; i++) {
    let type = wpick(G, Object.keys(PLANET_WEIGHTS), k => PLANET_WEIGHTS[k]);
    if (st === 'gat' && D.HABITABLE.includes(type)) type = 'kaal';
    s.planets.push(makePlanet(G, s, type, i));
  }
  s.anomaly = rnd(G) < 0.3;
  recomputeDeposits(s);
}
function makePlanet(G, s, type, i) {
  const hab = D.HABITABLE.includes(type);
  return { type, size: hab ? (type === 'gaia' ? rint(G, 10, 13) : rint(G, 4, 10)) : rint(G, 3, 9), name: s.name + ' ' + D.ROMAN[i], colony: null, orbit: 24 + i * 13 + rint(G, 0, 4), phase: rnd(G) * Math.PI * 2 };
}
function recomputeDeposits(s) {
  const dep = { E: 0, M: 0, R: 0 };
  const sd = D.STAR_TYPES[s.star].dep || {};
  for (const k in sd) dep[k] += sd[k];
  for (const p of s.planets) {
    const pd = D.PLANET_TYPES[p.type].dep;
    if (pd) for (const k in pd) dep[k] += pd[k];
  }
  if (s.extraDep) for (const k in s.extraDep) dep[k] += s.extraDep[k];
  if (s.relay) { dep.E += 3; dep.R += 3; }
  if (s.blight) for (const k in dep) dep[k] = Math.floor(dep[k] / 2);
  s.dep = dep;
}

// ---------- Empire helpers ----------
const emp = (G, id) => G.empires[id];
const faction = (e) => D.FACTIONS.find(f => f.id === e.faction);
function recomputeMods(G, e) {
  const m = { E: 0, M: 0, R: 0, I: 0, weapon: 0, shield: 0, hull: 0, growth: 0, maxPop: 0, slots: 0, vision: 0, anomaly: 0, speed: 0, buildTime: 0, shipCost: 0, buildCost: 0, opinion: 0, trade: 0, freeWar: 0 };
  const f = faction(e);
  for (const k in f.mods) m[k] = (m[k] || 0) + f.mods[k];
  for (const t in e.techs) {
    const T = D.TECH_BY_ID[t];
    if (T) for (const k in T.eff) m[k] = (m[k] || 0) + T.eff[k];
  }
  const rep = e.repeat || 0;
  m.E += rep * 0.05; m.M += rep * 0.05; m.R += rep * 0.05; m.weapon += rep * 0.03; m.hull += rep * 0.03;
  if (e.bonus) for (const k in e.bonus) m[k] = (m[k] || 0) + e.bonus[k];
  if (e.edicts) for (const id in e.edicts) { const E = D.EDICTS[id]; for (const k in E.eff) m[k] = (m[k] || 0) + E.eff[k]; }
  e.mods = m;
}
function relation(G, a, b) { return G.empires[a].rel[b]; }
function atWar(G, a, b) {
  if (a === b) return false;
  if (a < 0 || b < 0) return true;
  return !!G.empires[a].rel[b].war;
}
/** Hostility: neutrals (-1) and crisis (-2) are hostile to every empire but not to each other. */
function hostile(G, a, b) {
  if (a === b) return false;
  if (a < 0 && b < 0) return false;
  return atWar(G, a, b);
}

function shipStats(G, empId, t) {
  if (D.SHIPS[t]) {
    const S = D.SHIPS[t];
    const m = empId >= 0 ? G.empires[empId].mods : null;
    return {
      atk: S.atk * (1 + (m ? m.weapon : 0)),
      hp: Math.round(S.hp * (1 + (m ? m.hull : 0))),
      sh: Math.round(S.sh * (1 + (m ? m.shield : 0))),
      ev: S.ev, civ: !!S.civ,
    };
  }
  const M = D.MONSTER_SHIPS[t];
  const sc = empId === -2 ? (G.crisis ? G.crisis.scale : 1) : 1;
  return { atk: M.atk * sc, hp: Math.round(M.hp * sc), sh: Math.round(M.sh * sc), ev: M.ev, civ: false, structure: !!M.structure };
}
function fleetArmed(G, f) { return f.ships.some(s => !(D.SHIPS[s.t] && D.SHIPS[s.t].civ)); }
function fleetIsCiv(f) { return f.ships.length > 0 && D.SHIPS[f.ships[0].t] && D.SHIPS[f.ships[0].t].civ; }
/** Lanchester-style combat strength: sqrt(totalAttack × totalDurability). */
function powerOf(G, ships, empId) {
  let a = 0, h = 0;
  let titan = false;
  for (const s of ships) {
    const st = shipStats(G, empId, s.t);
    if (st.civ) continue;
    a += st.atk; h += s.hp + st.sh;
    if (s.t === 'titaan') titan = true;
  }
  if (titan) a *= 1.15;
  return Math.sqrt(a * h);
}
function fleetPower(G, f) { return powerOf(G, f.ships, f.emp); }
function empirePower(G, empId) {
  let p = 0;
  for (const f of G.fleets) if (f.emp === empId) p += fleetPower(G, f);
  return p;
}
function starbasePower(G, s) {
  if (s.owner == null || s.starbase.level === 0 || s.starbase.hp <= 0) return 0;
  const sb = D.STARBASES[s.starbase.level];
  return Math.sqrt(sb.atk * s.starbase.hp);
}
/** Defensive strength hostile to `empId` present in system. */
function defenseAt(G, sysId, empId) {
  const ships = [];
  let extra = 0;
  for (const f of G.fleets) {
    if (f.sys !== sysId || !hostile(G, f.emp, empId)) continue;
    for (const s of f.ships) ships.push({ ...s, _e: f.emp });
  }
  // approximate: group by emp
  const byEmp = {};
  for (const s of ships) (byEmp[s._e] = byEmp[s._e] || []).push(s);
  let p = 0;
  for (const k in byEmp) p += powerOf(G, byEmp[k], +k);
  const s = G.systems[sysId];
  if (s.owner != null && hostile(G, s.owner, empId)) {
    extra += starbasePower(G, s);
    for (const c of coloniesIn(G, sysId)) if (c.gar > 0) extra += Math.sqrt((2 + c.pop * 0.8 + (c.buildings.includes('schild') ? 12 : 0)) * (c.gar + (c.buildings.includes('schild') ? 80 : 0)));
  }
  return p + extra;
}

function coloniesOf(G, empId) { return G.colonies.filter(c => c.emp === empId); }
function coloniesIn(G, sysId) { return G.colonies.filter(c => c.sys === sysId); }
function systemsOf(G, empId) { return G.systems.filter(s => s.owner === empId); }
function fleetsAt(G, sysId) { return G.fleets.filter(f => f.sys === sysId); }

function log(G, empId, text, type, sys) {
  G.log.push({ turn: G.turn, emp: empId, text, type: type || 'info', sys: sys == null ? null : sys });
  if (G.log.length > 400) G.log.splice(0, G.log.length - 400);
}
function notifyAll(G, text, type, sys) { log(G, -1, text, type, sys); }

