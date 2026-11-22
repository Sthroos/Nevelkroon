// ===================== NEVELKROON — spelopzet, commando's en beurtverwerking =====================

// ---------- Setup ----------
/**
 * Create a new game state.
 * @param {{size:string, ais:number, difficulty:string, faction:string|null, seed:number, allAI?:boolean, empireName?:string}} opts
 */
function createGame(opts) {
  if (!D.GALAXY_SIZES[opts.size]) fail('Ongeldige grootte');
  if (!D.DIFFICULTY[opts.difficulty]) fail('Ongeldige moeilijkheid');
  if (!(opts.ais >= 1 && opts.ais <= 4)) fail('Aantal tegenstanders moet 1–4 zijn');
  const G = {
    version: 1, seed: opts.seed >>> 0, rng: opts.seed | 0, turn: 1,
    settings: { size: opts.size, ais: opts.ais, difficulty: opts.difficulty },
    systems: [], lanes: [], empires: [], colonies: [], fleets: [], nextId: 1,
    log: [], pending: [], crisis: null, kroon: null, dom: null, over: null, anim: null, playerId: opts.allAI ? -1 : 0,
  };
  generateGalaxy(G, opts.size);

  // factions
  const pool = shuffle(G, D.FACTIONS.map(f => f.id).filter(id => id !== opts.faction));
  const facs = opts.allAI ? pool.slice(0, opts.ais + 1) : [opts.faction, ...pool.slice(0, opts.ais)];
  if (!opts.allAI && !D.FACTIONS.some(f => f.id === opts.faction)) fail('Onbekende factie');

  // capitals: farthest-first by graph distance
  const cands = G.systems.filter(s => s.lanes.length >= 2).map(s => s.id);
  const caps = [pick(G, cands)];
  while (caps.length < facs.length) {
    const d = multiBfs(G, caps);
    let best = -1, bestD = -1;
    for (const c of cands) if (!caps.includes(c) && d[c] > bestD && d[c] < Infinity) { bestD = d[c]; best = c; }
    caps.push(best);
  }
  facs.forEach((fid, i) => {
    const f = D.FACTIONS.find(x => x.id === fid);
    const e = {
      id: i, faction: fid, name: (i === 0 && opts.empireName) ? opts.empireName : f.name, color: f.color,
      isPlayer: !opts.allAI && i === 0, alive: true,
      res: { E: 120, M: 160, R: 0, I: 15 }, income: { E: 0, M: 0, R: 0, I: 0 },
      techs: {}, research: { current: null, progress: 0, options: [] }, repeat: 0, bonus: {},
      known: {}, vis: {}, rel: {}, capital: caps[i], mods: null,
      stats: { lost: 0, killed: 0, captured: 0 }, score: [], edicts: {}, ai: { warTarget: null, lastWarCheck: 0 },
    };
    recomputeMods(G, e);
    G.empires.push(e);
  });
  for (const a of G.empires) for (const b of G.empires) if (a.id !== b.id)
    a.rel[b.id] = { war: false, pact: false, contact: false, mod: 0, warSince: 0, lastWar: -999, gifts: 0, warScore: 0 };

  for (const e of G.empires) setupCapital(G, e);
  placeRelays(G, caps);
  placeMonsters(G, caps);
  for (const e of G.empires) {
    rollTechOptions(G, e);
    updateVision(G, e);
    const d = bfsDist(G, e.capital);
    G.systems.forEach((s, i) => { if (d[i] <= 2 && !e.known[i]) e.known[i] = 1; });
    e.known[e.capital] = 2;
  }
  for (const f of G.fleets) if (f.auto) autoExplore(G, f);
  for (const e of G.empires) e.income = computeIncome(G, e);
  log(G, -1, 'De Kroonrelais ontwaken. De race om de Nevelkroon is begonnen.', 'big');
  return G;
}

function setupCapital(G, e) {
  const s = G.systems[e.capital];
  const f = faction(e);
  s.star = pick(G, ['geel', 'oranje', 'wit']);
  s.anomaly = false;
  s.planets = [
    makePlanet(G, s, f.pref, 0), makePlanet(G, s, 'kaal', 1), makePlanet(G, s, 'gas', 2), makePlanet(G, s, 'asteroid', 3),
  ];
  s.planets[0].size = 16;
  s.planets[0].name = s.name + ' Prime';
  recomputeDeposits(s);
  s.owner = e.id;
  s.starbase = { level: 2, hp: D.STARBASES[2].hp };
  const c = { id: G.nextId++, emp: e.id, sys: s.id, pi: 0, pop: 8, buildings: ['kern', 'mijn', 'centrale', 'lab', 'werf'], bq: [], sq: [], cap: true, gar: 160 };
  s.planets[0].colony = c.id;
  G.colonies.push(c);
  e.known[s.id] = 2;
  // fairness: at least 2 habitable planets within 2 jumps, and a few claimable systems around
  const d = bfsDist(G, s.id);
  const near = G.systems.filter(x => d[x.id] >= 1 && d[x.id] <= 2 && x.owner == null && x.star !== 'gat');
  let habs = near.reduce((n, x) => n + x.planets.filter(p => D.HABITABLE.includes(p.type)).length, 0);
  for (const x of shuffle(G, near.slice())) {
    if (habs >= 3) break;
    if (x.planets.length >= 6) continue;
    const type = rnd(G) < 0.5 ? f.pref : pick(G, ['aards', 'oceaan', 'woestijn', 'toendra', 'ijs']);
    x.planets.push(makePlanet(G, x, type, x.planets.length));
    x.planets[x.planets.length - 1].size = rint(G, 6, 10);
    habs++;
  }
  spawnFleet(G, e.id, s.id, [{ t: 'verkenner' }], { auto: true });
  spawnFleet(G, e.id, s.id, [{ t: 'verkenner' }], { auto: true });
  spawnFleet(G, e.id, s.id, [{ t: 'bouwschip' }]);
  spawnFleet(G, e.id, s.id, [{ t: 'korvet' }, { t: 'korvet' }, { t: 'korvet' }]);
}

function placeRelays(G, caps) {
  const n = { klein: 4, middel: 5, groot: 6 }[G.settings.size];
  const relays = [];
  for (let k = 0; k < n; k++) {
    const d = multiBfs(G, [...caps, ...relays]);
    const dc = multiBfs(G, caps);
    let best = -1, bestV = -1;
    for (const s of G.systems) {
      if (s.owner != null || relays.includes(s.id) || dc[s.id] < 3) continue;
      const v = d[s.id] + rnd(G) * 0.5;
      if (v > bestV) { bestV = v; best = s.id; }
    }
    if (best < 0) break;
    relays.push(best);
    const s = G.systems[best];
    s.relay = true; s.anomaly = false;
    recomputeDeposits(s);
    spawnMonster(G, best, 'wachter');
  }
  G.relays = relays;
}
function placeMonsters(G, caps) {
  const dc = multiBfs(G, caps);
  const free = G.systems.filter(s => !s.relay && s.owner == null && dc[s.id] >= 3);
  for (const s of free) if (rnd(G) < 0.12) spawnMonster(G, s.id, 'kristal');
  // pirate bases: 3–5 jumps from the nearest capital, so they are met while expanding
  const pirSpots = shuffle(G, free.filter(s => dc[s.id] >= 3 && dc[s.id] <= 5 && !G.fleets.some(f => f.sys === s.id)));
  const placed = [];
  for (const s of pirSpots) {
    if (placed.length >= D.RULES.pirateBases[G.settings.size]) break;
    if (placed.some(p => bfsDist(G, p)[s.id] < 3)) continue;
    const b = spawnMonster(G, s.id, 'piratenbasis');
    b.pirTimer = D.RULES.pirateFirstRaid + rint(G, 0, 6);
    placed.push(s.id);
  }
  if (G.settings.size !== 'klein') {
    const far = free.filter(s => !G.fleets.some(f => f.sys === s.id)).sort((a, b) => dc[b.id] - dc[a.id])[0];
    if (far) {
      spawnMonster(G, far.id, 'draak');
      far.planets.push(makePlanet(G, far, 'gaia', far.planets.length));
      far.extraDep = { E: 3, M: 3, R: 3 };
      recomputeDeposits(far);
    }
  }
}

function spawnFleet(G, empId, sysId, shipList, extra) {
  const f = { id: G.nextId++, emp: empId, sys: sysId, prev: sysId, ships: [], path: [], order: null, prog: 0, auto: false, ...extra };
  for (const sh of shipList) f.ships.push({ t: sh.t, hp: shipStats(G, empId, sh.t).hp });
  G.fleets.push(f);
  return f;
}
function spawnMonster(G, sysId, type) {
  const M = D.MONSTERS[type];
  const list = [];
  for (const [t, n] of M.ships) for (let i = 0; i < n; i++) list.push({ t });
  return spawnFleet(G, -1, sysId, list, { monster: type, loot: { ...M.loot } });
}

// ---------- Economy ----------
function colonyMaxPop(G, c) {
  const p = G.systems[c.sys].planets[c.pi];
  const e = G.empires[c.emp];
  const pt = D.PLANET_TYPES[p.type];
  let hab = pt.hab;
  if (faction(e).pref === p.type) hab += 0.2;
  let m = p.size * hab * (1 + e.mods.maxPop);
  if (c.buildings.includes('habitat')) m += 3;
  return Math.max(2, Math.round(m));
}
function colonySlots(G, c) {
  const e = G.empires[c.emp];
  return Math.min(8, 2 + Math.floor(c.pop / 3) + (e.mods.slots || 0));
}
function usedSlots(c) {
  return c.buildings.filter(b => !D.BUILDINGS[b].noSlot).length + c.bq.length;
}
/** Net per-turn income (after modifiers and upkeep). Pure w.r.t. G. */
function computeIncome(G, e) {
  const gross = { E: 0, M: 0, R: 0, I: 3 };
  let upkeep = 0;
  for (const c of G.colonies) {
    if (c.emp !== e.id) continue;
    const pop = Math.floor(c.pop);
    const eff = c.unrest > 0 ? 0.5 : 1;
    gross.E += pop * 0.5 * eff; gross.M += pop * 0.5 * eff; gross.R += pop * 0.35 * eff;
    for (const b of c.buildings) {
      const B = D.BUILDINGS[b];
      for (const k in B.out) gross[k] += B.out[k] * eff;
      upkeep += B.up;
    }
  }
  for (const s of G.systems) {
    if (s.owner !== e.id) continue;
    for (const k in s.dep) gross[k] += s.dep[k];
    upkeep += D.STARBASES[s.starbase.level] ? D.STARBASES[s.starbase.level].up : 0;
  }
  for (const f of G.fleets) {
    if (f.emp !== e.id) continue;
    for (const sh of f.ships) upkeep += D.SHIPS[sh.t].up;
  }
  const aiMul = e.isPlayer ? 1 : D.DIFFICULTY[G.settings.difficulty].ai;
  const out = {};
  for (const k of D.RES_KEYS) out[k] = gross[k] * (1 + (e.mods[k] || 0)) * (k === 'I' ? 1 : aiMul);
  out.E -= upkeep;
  if (e.res.E < 0) { out.M *= 0.7; out.R *= 0.7; }
  for (const k of D.RES_KEYS) out[k] = Math.round(out[k] * 10) / 10;
  out.upkeep = Math.round(upkeep * 10) / 10;
  return out;
}

// ---------- Costs ----------
function buildingCost(G, e, b) { return Math.round(D.BUILDINGS[b].cost * (1 + (e.mods.buildCost || 0))); }
function buildingTurns(G, e, b) { return Math.max(1, D.BUILDINGS[b].turns - (e.mods.buildTime || 0)); }
function shipCost(G, e, t) { return Math.round(D.SHIPS[t].cost * (1 + (e.mods.shipCost || 0))); }
function shipTurns(G, e, t) { return Math.max(1, D.SHIPS[t].turns - (e.mods.buildTime || 0)); }
function outpostCostI(G, e) { return D.RULES.outpostBaseI + Math.floor(systemsOf(G, e.id).length / D.RULES.outpostPerSystems); }
function techCost(G, e, id) {
  if (id === 'rep') return Math.round(D.TECH_COST[5] * (1 + 0.25 * (e.repeat || 0)));
  const T = D.TECH_BY_ID[id];
  return Math.round(D.TECH_COST[T.tier] * (1 + 0.025 * Object.keys(e.techs).length));
}

// ---------- Research ----------
function availableTechs(G, e) {
  return D.TECHS.filter(t => !e.techs[t.id] && (t.req || []).every(r => e.techs[r]));
}
function rollTechOptions(G, e) {
  const av = availableTechs(G, e);
  const opts = [];
  // one per category if possible, prefer lower tiers
  const pool = shuffle(G, av.slice());
  for (const cat of shuffle(G, ['ph', 'en', 'so'])) {
    const c = pool.filter(t => t.cat === cat && !opts.includes(t.id));
    if (!c.length) continue;
    const t = wpick(G, c, x => 1 / x.tier);
    opts.push(t.id);
  }
  while (opts.length < 3) {
    const rest = pool.filter(t => !opts.includes(t.id));
    if (!rest.length) break;
    opts.push(wpick(G, rest, x => 1 / x.tier).id);
  }
  if (opts.length < 3) opts.push('rep');
  e.research.options = opts.slice(0, 3);
}
function chooseResearch(G, empId, id) {
  const e = G.empires[empId];
  if (!e.research.options.includes(id)) fail('Deze technologie is nu niet beschikbaar');
  e.research.current = id;
}
function completeResearch(G, e, id) {
  if (id === 'rep') { e.repeat = (e.repeat || 0) + 1; }
  else e.techs[id] = true;
  recomputeMods(G, e);
  e.research.current = null;
  rollTechOptions(G, e);
  const name = id === 'rep' ? 'Doorbraak ' + e.repeat : D.TECH_BY_ID[id].name;
  log(G, e.id, 'Onderzoek voltooid: ' + name + ' — ' + (id === 'rep' ? '+5% energie, mineralen en onderzoek' : D.TECH_BY_ID[id].txt), 'tech');
  if (id === 'ph_relay') for (const r of G.relays) if (!e.known[r]) e.known[r] = 1;
  // heal ships to new max is not automatic; new hull applies to repairs
}

// ---------- Commands (player + AI) ----------
function getColony(G, id) { const c = G.colonies.find(x => x.id === id); if (!c) fail('Kolonie bestaat niet'); return c; }
function getFleet(G, id) { const f = G.fleets.find(x => x.id === id); if (!f) fail('Vloot bestaat niet'); return f; }

function canBuild(G, c, b) {
  const e = G.empires[c.emp];
  const B = D.BUILDINGS[b];
  if (!B || B.hidden) return 'Onbekend gebouw';
  if (B.req && !e.techs[B.req]) return 'Vereist ' + D.TECH_BY_ID[B.req].name;
  if (B.unique && (c.buildings.includes(b) || c.bq.some(q => q.id === b))) return 'Al aanwezig';
  if (usedSlots(c) >= colonySlots(G, c)) return 'Geen vrije bouwplaats';
  if (e.res.E < buildingCost(G, e, b)) return 'Te weinig energie';
  return null;
}
function queueBuilding(G, colonyId, b) {
  const c = getColony(G, colonyId);
  const why = canBuild(G, c, b);
  if (why) fail(why);
  const e = G.empires[c.emp];
  const cost = buildingCost(G, e, b);
  e.res.E -= cost;
  c.bq.push({ id: b, left: buildingTurns(G, e, b), paid: cost });
}
function canBuildShip(G, c, t) {
  const e = G.empires[c.emp];
  const S = D.SHIPS[t];
  if (!S) return 'Onbekend schip';
  if (!c.buildings.includes('werf')) return 'Vereist een scheepswerf';
  if (S.req && !e.techs[S.req]) return 'Vereist ' + D.TECH_BY_ID[S.req].name;
  if (S.unique && (G.fleets.some(f => f.emp === e.id && f.ships.some(s => s.t === t)) || G.colonies.some(x => x.emp === e.id && x.sq.some(q => q.id === t)))) return 'Maximaal één';
  if (c.sq.length >= 5) return 'Wachtrij vol';
  if (e.res.M < shipCost(G, e, t)) return 'Te weinig mineralen';
  if (S.costI && e.res.I < S.costI) return 'Te weinig invloed';
  return null;
}
function queueShip(G, colonyId, t) {
  const c = getColony(G, colonyId);
  const why = canBuildShip(G, c, t);
  if (why) fail(why);
  const e = G.empires[c.emp];
  const cost = shipCost(G, e, t);
  e.res.M -= cost;
  if (D.SHIPS[t].costI) e.res.I -= D.SHIPS[t].costI;
  c.sq.push({ id: t, left: shipTurns(G, e, t), paid: cost, paidI: D.SHIPS[t].costI || 0 });
}
function cancelQueue(G, colonyId, kind, idx) {
  const c = getColony(G, colonyId);
  const q = kind === 'b' ? c.bq : c.sq;
  if (!q[idx]) fail('Niets om te annuleren');
  const it = q.splice(idx, 1)[0];
  const e = G.empires[c.emp];
  if (kind === 'b') e.res.E += it.paid; else { e.res.M += it.paid; e.res.I += it.paidI || 0; }
}

function civAvoid(G, empId) {
  return (sid) => G.fleets.some(f => f.sys === sid && f.emp !== empId && hostile(G, f.emp, empId) && fleetArmed(G, f))
    || (G.systems[sid].owner != null && hostile(G, G.systems[sid].owner, empId) && G.systems[sid].starbase.hp > 0);
}
function knownAvoid(G, empId, base) {
  const e = G.empires[empId];
  return (sid) => (e.isPlayer && !e.known[sid]) || (base && base(sid));
}
function moveFleet(G, fleetId, target, keepOrder) {
  const f = getFleet(G, fleetId);
  if (f.emp < 0) fail('Geen eigen vloot');
  if (target === f.sys) { f.path = []; if (!keepOrder) f.order = null; return []; }
  const e = G.empires[f.emp];
  if (e.isPlayer && !e.known[target]) fail('Dit stelsel is onbekend');
  const avoid = fleetIsCiv(f) ? civAvoid(G, f.emp) : null;
  let p = findPath(G, f.sys, target, knownAvoid(G, f.emp, avoid));
  if (!p && avoid) p = findPath(G, f.sys, target, knownAvoid(G, f.emp, null));
  if (!p) fail('Geen route naar dit stelsel');
  f.path = p;
  if (!keepOrder) { f.order = null; f.auto = false; }
  f.prog = 0;
  return p;
}
/** A scout has work in a system if it is uncharted or still holds an unexplored anomaly. */
function needsSurvey(G, empId, sysId) {
  return G.empires[empId].known[sysId] !== 2 || G.systems[sysId].anomaly;
}
function orderSurvey(G, fleetId, target) {
  const f = getFleet(G, fleetId);
  if (f.ships[0].t !== 'verkenner') fail('Alleen verkenners kunnen verkennen');
  if (!needsSurvey(G, f.emp, target)) fail('Al verkend, geen anomalie');
  moveFleet(G, fleetId, target, true);
  f.order = { type: 'survey', target };
}
function canOutpost(G, empId, sysId) {
  const e = G.empires[empId];
  const s = G.systems[sysId];
  if (s.owner != null) return 'Stelsel is al geclaimd';
  if (e.known[sysId] !== 2) return 'Stelsel eerst verkennen';
  if (G.fleets.some(f => f.sys === sysId && f.emp < 0)) return 'Er zijn vijandige wezens aanwezig';
  if (G.fleets.some(f => f.emp === empId && f.order && f.order.type === 'outpost' && f.order.target === sysId)) return 'Er is al een bouwschip onderweg';
  if (e.res.M < D.RULES.outpostCostM) return 'Te weinig mineralen';
  if (e.res.I < outpostCostI(G, e)) return 'Te weinig invloed';
  return null;
}
function orderOutpost(G, fleetId, target) {
  const f = getFleet(G, fleetId);
  if (f.ships[0].t !== 'bouwschip') fail('Alleen bouwschepen bouwen buitenposten');
  if (f.order && f.order.paid) fail('Dit bouwschip heeft al een bouwopdracht');
  const why = canOutpost(G, f.emp, target);
  if (why) fail(why);
  const e = G.empires[f.emp];
  moveFleet(G, fleetId, target, true);
  const ci = outpostCostI(G, e);
  e.res.M -= D.RULES.outpostCostM; e.res.I -= ci;
  f.order = { type: 'outpost', target, paid: { M: D.RULES.outpostCostM, I: ci } };
  f.prog = 0;
}
function canUpgrade(G, empId, sysId) {
  const e = G.empires[empId];
  const s = G.systems[sysId];
  if (s.owner !== empId) return 'Niet jouw stelsel';
  const nx = D.STARBASES[s.starbase.level + 1];
  if (!nx) return 'Maximaal niveau';
  if (!e.techs[nx.req]) return 'Vereist ' + D.TECH_BY_ID[nx.req].name;
  if (e.res.M < nx.cost) return 'Te weinig mineralen';
  if (G.fleets.some(f => f.emp === empId && f.order && f.order.type === 'upgrade' && f.order.target === sysId)) return 'Er wordt al geüpgraded';
  return null;
}
function orderUpgrade(G, fleetId, target) {
  const f = getFleet(G, fleetId);
  if (f.ships[0].t !== 'bouwschip') fail('Alleen bouwschepen kunnen upgraden');
  if (f.order && f.order.paid) fail('Dit bouwschip heeft al een bouwopdracht');
  const why = canUpgrade(G, f.emp, target);
  if (why) fail(why);
  const nx = D.STARBASES[G.systems[target].starbase.level + 1];
  moveFleet(G, fleetId, target, true);
  G.empires[f.emp].res.M -= nx.cost;
  f.order = { type: 'upgrade', target, paid: { M: nx.cost, I: 0 } };
  f.prog = 0;
}
function canColonize(G, empId, sysId, pi) {
  const s = G.systems[sysId];
  const e = G.empires[empId];
  const p = s.planets[pi];
  if (!p) return 'Planeet bestaat niet';
  if (!D.HABITABLE.includes(p.type)) return 'Niet bewoonbaar';
  if (p.colony) return 'Al gekoloniseerd';
  if (s.owner != null && s.owner !== empId) return 'Stelsel is van een ander rijk';
  if (e.known[sysId] !== 2) return 'Stelsel eerst verkennen';
  if (G.fleets.some(f => f.sys === sysId && f.emp < 0)) return 'Er zijn vijandige wezens aanwezig';
  if (G.fleets.some(f => f.emp === empId && f.order && f.order.type === 'colonize' && f.order.target === sysId && f.order.pi === pi)) return 'Er is al een kolonieschip onderweg';
  return null;
}
function orderColonize(G, fleetId, target, pi) {
  const f = getFleet(G, fleetId);
  if (f.ships[0].t !== 'kolonie') fail('Alleen kolonieschepen koloniseren');
  const why = canColonize(G, f.emp, target, pi);
  if (why) fail(why);
  moveFleet(G, fleetId, target, true);
  f.order = { type: 'colonize', target, pi };
}
function cancelOrder(G, fleetId) {
  const f = getFleet(G, fleetId);
  if (f.order && f.order.paid) {
    const e = G.empires[f.emp];
    e.res.M += f.order.paid.M; e.res.I += f.order.paid.I;
  }
  f.order = null; f.path = []; f.auto = false; f.prog = 0;
}
function setAuto(G, fleetId, on) {
  const f = getFleet(G, fleetId);
  if (f.ships[0].t !== 'verkenner') fail('Automatisch verkennen kan alleen met een verkenner');
  f.auto = !!on;
  if (on && !f.order) autoExplore(G, f);
}
function mergeFleets(G, sysId, empId) {
  const fs = G.fleets.filter(f => f.sys === sysId && f.emp === empId && !fleetIsCiv(f));
  if (fs.length < 2) fail('Geen vloten om samen te voegen');
  const main = fs[0];
  for (const f of fs.slice(1)) { main.ships.push(...f.ships); }
  G.fleets = G.fleets.filter(f => !fs.slice(1).includes(f));
  main.path = [];
  return main;
}
function splitFleet(G, fleetId) {
  const f = getFleet(G, fleetId);
  if (fleetIsCiv(f) || f.ships.length < 2) fail('Kan niet splitsen');
  const half = f.ships.splice(Math.ceil(f.ships.length / 2));
  const nf = { id: G.nextId++, emp: f.emp, sys: f.sys, prev: f.sys, ships: half, path: [], order: null, prog: 0, auto: false };
  G.fleets.push(nf);
  return nf;
}

function autoExplore(G, f) {
  const e = G.empires[f.emp];
  const d = bfsDist(G, f.sys);
  const taken = new Set(G.fleets.filter(x => x !== f && x.emp === f.emp && x.order && x.order.type === 'survey').map(x => x.order.target));
  const avoid = civAvoid(G, f.emp);
  const cands = [];
  for (const s of G.systems) {
    if (!needsSurvey(G, f.emp, s.id) || taken.has(s.id) || d[s.id] === Infinity) continue;
    if (e.isPlayer && !e.known[s.id] && !s.lanes.some(n => e.known[n])) continue; // frontier: unknown but next to known space
    if (avoid(s.id)) continue;
    cands.push({ id: s.id, v: d[s.id] + rnd(G) * 0.6 });
  }
  cands.sort((a, b) => a.v - b.v);
  for (const c of cands) {
    const p = findPath(G, f.sys, c.id, knownAvoid(G, f.emp, avoid));
    if (p) { f.path = p; f.order = { type: 'survey', target: c.id }; return true; }
  }
  f.order = null;
  // Stay on auto while survey work remains somewhere; new systems come into view every turn.
  const workLeft = G.systems.some(s => needsSurvey(G, f.emp, s.id) && d[s.id] < Infinity && !avoid(s.id));
  if (!workLeft) {
    f.auto = false;
    if (e.isPlayer) log(G, e.id, 'Een verkenner heeft niets meer te verkennen en wacht op orders.', 'info', f.sys);
  }
  return false;
}

// ---------- Diplomacy ----------
function opinion(G, a, b) {
  // how a feels about b
  if (a < 0 || b < 0) return -100;
  const ea = G.empires[a], eb = G.empires[b];
  const r = ea.rel[b];
  let o = eb.mods.opinion || 0;
  o += ea.mods.opinion ? Math.round(ea.mods.opinion / 3) : 0;
  o += r.mod;
  if (r.pact) o += 25;
  if (r.war) o -= 40;
  const since = G.turn - r.lastWar;
  if (since < 40) o -= Math.round(30 * (1 - since / 40));
  if (bordersTouch(G, a, b)) o -= 10;
  if (G.kroon && G.kroon.emp === b) o -= 100;
  if (G.dom && G.dom.emp === b) o -= 60;
  return Math.max(-100, Math.min(100, Math.round(o)));
}
function bordersTouch(G, a, b) {
  for (const s of G.systems) if (s.owner === a) for (const n of s.lanes) if (G.systems[n].owner === b) return true;
  return false;
}
function canDeclareWar(G, a, b) {
  const e = G.empires[a];
  const r = e.rel[b];
  if (!G.empires[b].alive) return 'Rijk bestaat niet meer';
  if (!r.contact) return 'Geen contact';
  if (r.war) return 'Al in oorlog';
  if (r.pact) return 'Eerst het verdrag opzeggen';
  if (G.turn - r.lastWar < 20) return 'Wapenstilstand nog ' + (20 - (G.turn - r.lastWar)) + ' beurten';
  if (!e.mods.freeWar && e.res.I < D.RULES.warCostI) return 'Te weinig invloed (' + D.RULES.warCostI + ')';
  return null;
}
function declareWar(G, a, b) {
  const why = canDeclareWar(G, a, b);
  if (why) fail(why);
  const e = G.empires[a];
  if (!e.mods.freeWar) e.res.I -= D.RULES.warCostI;
  setWar(G, a, b, true);
  notifyAll(G, e.name + ' verklaart de oorlog aan ' + G.empires[b].name + '!', 'war');
}
function setWar(G, a, b, on) {
  const ra = G.empires[a].rel[b], rb = G.empires[b].rel[a];
  ra.war = rb.war = on;
  if (on) { ra.warSince = rb.warSince = G.turn; ra.warScore = rb.warScore = 0; ra.pact = rb.pact = false; }
  else { ra.lastWar = rb.lastWar = G.turn; }
}
/** AI willingness to accept peace with `from`. */
function aiAcceptsPeace(G, ai, from) {
  const r = G.empires[ai].rel[from];
  const myP = empirePower(G, ai) + 1, theirP = empirePower(G, from) + 1;
  const dur = G.turn - r.warSince;
  if (G.kroon && G.kroon.emp === from) return false;
  if (G.dom && G.dom.emp === from) return false;
  if (dur < 8) return false;
  if (r.warScore < -15) return true;
  if (myP < theirP * 0.8) return true;
  if (dur > 30 && r.warScore < 20) return true;
  return false;
}
function proposePeace(G, a, b) {
  const r = G.empires[a].rel[b];
  if (!r.war) fail('Niet in oorlog');
  const accepted = G.empires[b].isPlayer ? false : aiAcceptsPeace(G, b, a);
  if (accepted) { setWar(G, a, b, false); notifyAll(G, G.empires[a].name + ' en ' + G.empires[b].name + ' sluiten vrede.', 'peace'); }
  return accepted;
}
function aiAcceptsPact(G, ai, from) { return opinion(G, ai, from) >= 20 && !G.empires[ai].rel[from].war; }
function proposePact(G, a, b) {
  const e = G.empires[a];
  const r = e.rel[b];
  if (r.war) fail('Eerst vrede sluiten');
  if (r.pact) fail('Er is al een verdrag');
  if (!r.contact) fail('Geen contact');
  if (e.res.I < D.RULES.pactCostI) fail('Te weinig invloed (' + D.RULES.pactCostI + ')');
  const ok = aiAcceptsPact(G, b, a);
  if (ok) {
    e.res.I -= D.RULES.pactCostI;
    r.pact = G.empires[b].rel[a].pact = true;
    notifyAll(G, e.name + ' en ' + G.empires[b].name + ' sluiten een niet-aanvalsverdrag.', 'peace');
  }
  return ok;
}
function cancelPact(G, a, b) {
  const r = G.empires[a].rel[b];
  if (!r.pact) fail('Geen verdrag');
  r.pact = G.empires[b].rel[a].pact = false;
  G.empires[b].rel[a].mod -= 25;
  log(G, b, G.empires[a].name + ' heeft het verdrag met ons opgezegd.', 'war');
}
function sendGift(G, a, b) {
  const e = G.empires[a];
  if (e.res.E < D.RULES.giftE) fail('Te weinig energie');
  if (!e.rel[b].contact) fail('Geen contact');
  e.res.E -= D.RULES.giftE;
  G.empires[b].res.E += D.RULES.giftE;
  const r = G.empires[b].rel[a];
  r.mod += Math.max(3, 14 - r.gifts * 3);
  r.gifts++;
}
function marketTrade(G, empId, from, amount) {
  const e = G.empires[empId];
  if (!['E', 'M'].includes(from)) fail('Ongeldige handel');
  if (!(amount > 0) || e.res[from] < amount) fail('Te weinig ' + D.RES_NAMES[from].toLowerCase());
  const rate = e.mods.trade ? D.RULES.marketRateTyr : D.RULES.marketRate;
  const to = from === 'E' ? 'M' : 'E';
  e.res[from] -= amount;
  e.res[to] += Math.floor(amount / rate);
}

// ---------- Edicts ----------
function canEdict(G, empId, id) {
  const e = G.empires[empId];
  const E = D.EDICTS[id];
  if (!E) return 'Onbekend edict';
  if (e.edicts[id]) return 'Al actief';
  if (e.res.I < E.cost) return 'Te weinig invloed (' + E.cost + ')';
  return null;
}
function enactEdict(G, empId, id) {
  const why = canEdict(G, empId, id);
  if (why) fail(why);
  const e = G.empires[empId];
  e.res.I -= D.EDICTS[id].cost;
  e.edicts[id] = D.EDICTS[id].turns;
  recomputeMods(G, e);
}
function shipyardSlots(G, e) { return 2 + (e.techs.en_automation ? 1 : 0); }

// ---------- Kroon victory ----------
function relaysNeeded(G) { return Math.max(2, Math.ceil(G.relays.length / 2)); }
function relaysHeld(G, empId) { return G.relays.filter(r => G.systems[r].owner === empId).length; }
function canStartKroon(G, empId) {
  const e = G.empires[empId];
  if (G.kroon) return 'De Kroon wordt al gewekt';
  if (!e.techs.ph_kroon) return 'Vereist De Kroonsleutel';
  if (relaysHeld(G, empId) < relaysNeeded(G)) return 'Bezit minstens ' + relaysNeeded(G) + ' Kroonrelais';
  if (e.res.I < D.RULES.kroonCostI) return 'Te weinig invloed (' + D.RULES.kroonCostI + ')';
  if (e.res.E < D.RULES.kroonCostE) return 'Te weinig energie (' + D.RULES.kroonCostE + ')';
  return null;
}
function startKroon(G, empId) {
  const why = canStartKroon(G, empId);
  if (why) fail(why);
  const e = G.empires[empId];
  e.res.I -= D.RULES.kroonCostI; e.res.E -= D.RULES.kroonCostE;
  const turns = D.RULES.kroonTurns - (e.faction === 'synode' ? 5 : 0);
  G.kroon = { emp: empId, left: turns };
  notifyAll(G, e.name + ' begint met het ontwaken van de Nevelkroon! Over ' + turns + ' beurten is het te laat.', 'big');
  for (const o of G.empires) if (o.id !== empId && o.alive && !o.isPlayer) {
    o.rel[empId].contact = true; e.rel[o.id].contact = true;
    if (!o.rel[empId].war) { setWar(G, o.id, empId, true); notifyAll(G, o.name + ' verklaart de oorlog aan ' + e.name + ' om de Kroon te stoppen!', 'war'); }
  }
}

// ---------- Event resolution ----------
/** Records a named special feature on a system so the player can find it back later. */
function addFeature(G, sysId, feat) {
  const s = G.systems[sysId];
  s.feats = s.feats || [];
  const ex = s.feats.find(f => f.name === feat.name);
  if (ex) { ex.amt += feat.amt; ex.max = Math.max(ex.max || 0, feat.max || 0) || undefined; } else s.feats.push(feat);
}
function applyEffects(G, e, fx, sysId, title) {
  const msgs = [];
  for (const k of ['E', 'M', 'R', 'I']) if (fx[k]) {
    let v = fx[k];
    if (v > 0) v = Math.round(v * (1 + (e.mods.anomaly || 0) * 0.5));
    if (k === 'R') { e.research.progress += v; } else e.res[k] += v;
    msgs.push((v > 0 ? '+' : '') + v + ' ' + D.RES_NAMES[k].toLowerCase());
  }
  if (fx.research) {
    const cur = e.research.current || e.research.options[0];
    const cost = techCost(G, e, cur);
    e.research.progress += Math.round(cost * fx.research);
    msgs.push('Onderzoek versneld');
  }
  if (fx.pop) {
    const cap = G.colonies.find(c => c.emp === e.id && c.cap) || G.colonies.find(c => c.emp === e.id);
    if (cap) { cap.pop = Math.min(colonyMaxPop(G, cap), cap.pop + fx.pop); msgs.push('+' + fx.pop + ' bevolking'); }
  }
  for (const k of ['M', 'R']) {
    const amt = fx['dep' + k];
    if (!amt || sysId == null) continue;
    const s = G.systems[sysId];
    s.extraDep = s.extraDep || {}; s.extraDep[k] = (s.extraDep[k] || 0) + amt; recomputeDeposits(s);
    addFeature(G, sysId, { name: title || 'Bijzondere bron', res: k, amt, max: fx.grow || undefined, emp: e.id });
    msgs.push('+' + amt + ' ' + (k === 'M' ? 'mineralen' : 'onderzoeks') + 'bron bij ' + s.name + (fx.grow ? ' (groeit tot +' + fx.grow + ')' : '') + (s.owner === e.id ? '' : '; bouw er een buitenpost om het te gebruiken'));
  }
  if (fx.gaia && sysId != null) {
    const s = G.systems[sysId];
    const p = s.planets.find(x => !x.colony && x.type !== 'gas' && x.type !== 'asteroid') || s.planets[0];
    if (p && !p.colony) { p.type = 'gaia'; p.size = Math.max(p.size, 10); recomputeDeposits(s); addFeature(G, sysId, { name: 'Gaia-wereld', txt: p.name + ' is een paradijswereld', amt: 0 }); msgs.push(p.name + ' is nu een Gaia-wereld'); }
  }
  if (fx.reveal) { for (const r of G.relays) if (!e.known[r]) e.known[r] = 1; msgs.push('Kroonrelais onthuld'); }
  if (fx.modR) { e.bonus.R = (e.bonus.R || 0) + fx.modR; recomputeMods(G, e); msgs.push('+' + Math.round(fx.modR * 100) + '% onderzoek'); }
  if (fx.opinionAll) { for (const o of G.empires) if (o.id !== e.id) o.rel[e.id].mod += fx.opinionAll; msgs.push('Andere rijken wantrouwen je'); }
  if (fx.pirates && sysId != null) { spawnMonster(G, sysId, 'piraten'); msgs.push('Piraten verschijnen!'); }
  if (fx.wake && sysId != null) {
    const good = rnd(G) < 0.5 + (e.mods.anomaly || 0);
    if (good) {
      const t = e.techs.en_cruiser ? 'slagschip' : 'kruiser';
      spawnFleet(G, e.id, sysId, [{ t }]);
      msgs.push('Het schip sluit zich bij je aan: een ' + D.SHIPS[t].name + '!');
    } else { spawnMonster(G, sysId, 'ontwaakt'); msgs.push('Het schip is vijandig geworden!'); }
  }
  if (fx.risk && sysId != null) {
    if (rnd(G) < fx.risk * (1 - (e.mods.anomaly || 0))) {
      const sci = G.fleets.find(f => f.emp === e.id && f.sys === sysId && f.ships[0].t === 'verkenner');
      if (sci) { G.fleets = G.fleets.filter(f => f !== sci); msgs.push('De verkenner is vernietigd door een energiegolf!'); }
    }
  }
  return msgs.join(', ');
}
function resolvePending(G, idx, choice) {
  const ev = G.pending[idx];
  if (!ev) fail('Geen gebeurtenis');
  const e = G.empires[ev.emp];
  let res = '';
  if (ev.kind === 'anomaly') {
    const A = D.ANOMALIES.find(a => a.id === ev.id);
    const ch = A.choices[choice];
    if (!ch) fail('Ongeldige keuze');
    res = applyEffects(G, e, ch.fx, ev.sys, A.title);
    log(G, e.id, A.title + ' (' + G.systems[ev.sys].name + '): ' + (res || 'niets gebeurd'), 'event', ev.sys);
  } else if (ev.kind === 'peaceOffer' || ev.kind === 'pactOffer') {
    const accept = choice === 0;
    if (accept && ev.kind === 'peaceOffer' && e.rel[ev.from].war) { setWar(G, e.id, ev.from, false); notifyAll(G, e.name + ' en ' + G.empires[ev.from].name + ' sluiten vrede.', 'peace'); }
    if (accept && ev.kind === 'pactOffer' && !e.rel[ev.from].war) { e.rel[ev.from].pact = G.empires[ev.from].rel[e.id].pact = true; notifyAll(G, e.name + ' en ' + G.empires[ev.from].name + ' sluiten een niet-aanvalsverdrag.', 'peace'); }
    if (!accept) G.empires[ev.from].rel[e.id].mod -= 5;
  }
  G.pending.splice(idx, 1);
  return res;
}
function triggerAnomaly(G, e, sysId) {
  const A = pick(G, D.ANOMALIES);
  if (e.isPlayer) G.pending.push({ kind: 'anomaly', id: A.id, emp: e.id, sys: sysId });
  else {
    const ch = A.choices.length > 1 && rnd(G) < 0.5 ? A.choices[1] : A.choices[0];
    applyEffects(G, e, ch.fx, sysId, A.title);
  }
}
