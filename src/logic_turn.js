// ===================== NEVELKROON — beurtverwerking =====================

/** Advance the game by one turn. Returns the animation record for the renderer. */
function processTurn(G) {
  if (G.over) fail('Het spel is afgelopen');
  if (G.pending.some(p => G.empires[p.emp].isPlayer)) fail('Beantwoord eerst de openstaande gebeurtenissen');
  G.anim = { moves: [], combats: [], booms: [] };
  for (const e of G.empires) if (e.alive && !e.isPlayer) aiTurn(G, e);
  crisisAI(G);
  pirateAI(G);
  movementPhase(G);
  combatPhase(G);
  civilianLosses(G);
  siegePhase(G);
  plunderPhase(G);
  orderPhase(G);
  economyPhase(G);
  diplomacyPhase(G);
  randomEvents(G);
  featureGrowth(G);
  crisisPhase(G);
  kroonPhase(G);
  for (const e of G.empires) if (e.alive) updateVision(G, e);
  for (const f of G.fleets) if (f.auto && !f.order && !f.path.length) autoRun(G, f);
  contactPhase(G);
  victoryCheck(G);
  for (const e of G.empires) e.score.push(Math.round(scoreOf(G, e)));
  G.turn++;
  return G.anim;
}

// ---------- Movement ----------
function blocksAt(G, f, sysId) {
  // armed hostiles or hostile starbase stop movement
  if (G.fleets.some(o => o.sys === sysId && o !== f && hostile(G, o.emp, f.emp) && fleetArmed(G, o))) return true;
  const s = G.systems[sysId];
  return s.owner != null && hostile(G, s.owner, f.emp) && s.starbase.hp > 0 && s.starbase.level > 0;
}
/**
 * Lets a scout use leftover jumps: finishes a survey it is standing on and, when on auto,
 * picks the next target immediately. Returns true when the scout has a new path to follow.
 */
function scoutChain(G, f) {
  if (f.emp < 0 || f.ships[0].t !== 'verkenner') return false;
  const e = G.empires[f.emp];
  if (f.order && f.order.type === 'survey') {
    if (f.sys !== f.order.target) return false;
    const s = G.systems[f.sys];
    e.known[s.id] = 2;
    f.order = null;
    if (s.anomaly) { s.anomaly = false; triggerAnomaly(G, e, s.id); return false; } // investigating takes the rest of the turn
  }
  if (!f.auto || f.order) return false;
  updateVision(G, e);
  return autoExplore(G, f);
}
function movementPhase(G) {
  const order = shuffle(G, G.fleets.filter(f => ((f.path && f.path.length) || (f.auto && !f.order)) && (f.emp !== -1 || f.raider)));
  for (const f of order) {
    const speed = 1 + (f.emp >= 0 ? (G.empires[f.emp].mods.speed || 0) : 0) + (f.ships[0].t === 'verkenner' ? 1 : 0);
    f.prev = f.sys;
    for (let st = 0; st < speed; st++) {
      if (!f.path.length && !scoutChain(G, f)) break;
      const nx = f.path[0];
      if (!G.systems[f.sys].lanes.includes(nx)) { f.path = []; break; }
      G.anim.moves.push({ id: f.id, from: f.sys, to: nx, step: st, emp: f.emp });
      f.sys = nx;
      f.path.shift();
      if (f.emp >= 0) G.empires[f.emp].known[nx] = 2; // any ship passing through charts the planets
      if (blocksAt(G, f, nx)) break;
    }
  }
}

// ---------- Combat ----------
function combatPhase(G) {
  const sysIds = new Set(G.fleets.map(f => f.sys));
  for (const sid of sysIds) resolveCombat(G, sid);
  // repairs for fleets not in combat
  const fought = new Set(G.anim.combats.map(c => c.sys));
  for (const f of G.fleets) {
    if (fought.has(f.sys)) continue;
    const own = f.emp >= 0 && G.systems[f.sys].owner === f.emp;
    for (const s of f.ships) {
      const mx = shipStats(G, f.emp, s.t).hp;
      s.hp = Math.min(mx, s.hp + mx * (own ? 0.2 : f.emp < 0 ? 0.1 : 0.04));
    }
  }
  for (const c of G.colonies) {
    if (fought.has(c.sys) || G.systems[c.sys].siege) continue;
    const mx = garrisonMax(c);
    c.gar = Math.min(mx, (c.gar || 0) + mx * 0.15);
  }
  for (const s of G.systems) {
    if (s.starbase.level > 0 && !fought.has(s.id) && !s.siege) {
      const mx = D.STARBASES[s.starbase.level].hp;
      s.starbase.hp = Math.min(mx, s.starbase.hp + mx * 0.12);
    }
  }
}
function resolveCombat(G, sid) {
  const s = G.systems[sid];
  const parties = {};
  const add = (empId, u) => { (parties[empId] = parties[empId] || []).push(u); };
  for (const f of G.fleets) {
    if (f.sys !== sid) continue;
    const titan = f.ships.some(x => x.t === 'titaan');
    for (const sh of f.ships) {
      const st = shipStats(G, f.emp, sh.t);
      if (st.civ) continue;
      add(f.emp, { kind: 'ship', f, sh, atk: st.atk * (titan ? 1.15 : 1), sh0: st.sh, shield: st.sh, ev: st.ev, alive: true, dealt: 0 });
    }
  }
  if (s.owner != null && s.starbase.level > 0 && s.starbase.hp > 0) {
    const sb = D.STARBASES[s.starbase.level];
    add(s.owner, { kind: 'base', atk: sb.atk, shield: 0, ev: 0, alive: true, dealt: 0 });
  }
  if (s.owner != null) for (const c of coloniesIn(G, sid)) if (c.gar > 0) add(c.emp, { kind: 'planet', c, atk: garrisonAtk(c), shield: c.buildings.includes('schild') ? 80 : 0, ev: 0, alive: true, dealt: 0 });
  const ids = Object.keys(parties).map(Number);
  const hasFight = () => ids.some(a => parties[a].some(u => u.alive) && ids.some(b => hostile(G, a, b) && parties[b].some(u => u.alive)));
  if (!hasFight()) return;
  const startCount = {};
  for (const a of ids) startCount[a] = parties[a].filter(u => u.kind === 'ship').length;
  const hpOf = (u) => u.kind === 'ship' ? u.sh.hp : u.kind === 'base' ? s.starbase.hp : u.c.gar;
  const setHp = (u, v) => { if (u.kind === 'ship') u.sh.hp = v; else if (u.kind === 'base') s.starbase.hp = v; else u.c.gar = v; };
  let shots = 0;
  const dmgBy = {};
  for (let round = 0; round < D.RULES.combatRounds && hasFight(); round++) {
    const hits = [];
    for (const a of ids) {
      const targets = [];
      for (const b of ids) if (hostile(G, a, b)) for (const u of parties[b]) if (u.alive) targets.push([b, u]);
      if (!targets.length) continue;
      for (const u of parties[a]) {
        if (!u.alive || u.atk <= 0) continue;
        const [b, t] = targets[Math.floor(rnd(G) * targets.length)];
        shots++;
        if (rnd(G) < t.ev) continue;
        hits.push([a, u, t, u.atk * (0.85 + rnd(G) * 0.3)]);
      }
    }
    for (const [a, u, t, dmg] of hits) {
      if (!t.alive) continue;
      let d = dmg;
      if (t.shield > 0) { const ab = Math.min(t.shield, d * 0.7); t.shield -= ab; d -= ab; }
      setHp(t, hpOf(t) - d);
      dmgBy[a] = (dmgBy[a] || 0) + dmg;
      if (hpOf(t) <= 0) t.alive = false;
    }
  }
  // apply deaths
  const losses = {};
  for (const a of ids) for (const u of parties[a]) {
    if (u.alive) continue;
    if (u.kind === 'ship') {
      u.f.ships = u.f.ships.filter(x => x !== u.sh);
      losses[a] = (losses[a] || 0) + 1;
      G.anim.booms.push({ sys: sid, big: D.SHIPS[u.sh.t] ? (D.SHIPS[u.sh.t].size || 1) : 3 });
    } else if (u.kind === 'base') { s.starbase.hp = 0; G.anim.booms.push({ sys: sid, big: 4 }); }
    else if (u.kind === 'planet') { u.c.gar = 0; }
  }
  // stats + loot
  const killedTotal = Object.values(losses).reduce((a, b) => a + b, 0);
  for (const a of ids) if (a >= 0) {
    const e = G.empires[a];
    e.stats.lost += losses[a] || 0;
    e.stats.killed += killedTotal - (losses[a] || 0);
  }
  for (const a of ids) if (a >= 0) for (const b of ids) if (b >= 0 && hostile(G, a, b)) {
    G.empires[a].rel[b].warScore += (losses[b] || 0) - (losses[a] || 0);
  }
  const deadFleets = G.fleets.filter(f => f.sys === sid && f.ships.length === 0);
  for (const f of deadFleets) {
    if (f.loot) {
      const winners = ids.filter(a => a >= 0 && parties[a].some(u => u.alive));
      const w = winners.sort((x, y) => (dmgBy[y] || 0) - (dmgBy[x] || 0))[0];
      if (w != null) {
        const e = G.empires[w];
        for (const k in f.loot) { if (k === 'R') e.research.progress += f.loot[k]; else e.res[k] += f.loot[k]; }
        const nm = f.monster ? D.MONSTERS[f.monster].name : 'vijand';
        log(G, w, nm + ' verslagen bij ' + s.name + '! Buit: ' + Object.entries(f.loot).map(([k, v]) => v + ' ' + D.RES_ICONS[k]).join(' '), 'loot', sid);
        if (f.rift) onRiftDestroyed(G, w, f);
      }
    }
  }
  G.fleets = G.fleets.filter(f => f.ships.length > 0);
  G.anim.combats.push({ sys: sid, parties: ids, shots: Math.min(shots, 60), losses });
  for (const a of ids) if (a >= 0 && (G.empires[a].isPlayer)) {
    const lost = losses[a] || 0, kill = killedTotal - lost;
    log(G, a, 'Gevecht bij ' + s.name + ': ' + kill + ' vijandelijke eenheden vernietigd, ' + lost + ' eigen verloren.', 'combat', sid);
  }
}
function garrisonMax(c) { return Math.round(40 + c.pop * 15 + (c.buildings.includes('schild') ? 300 : 0)); }
function garrisonAtk(c) { return 2 + c.pop * 0.8 + (c.buildings.includes('schild') ? 12 : 0); }
function civilianLosses(G) {
  const dead = [];
  for (const f of G.fleets) {
    if (!fleetIsCiv(f) || f.emp < 0) continue;
    const enemies = G.fleets.some(o => o.sys === f.sys && hostile(G, o.emp, f.emp) && fleetArmed(G, o));
    if (!enemies) continue;
    const friends = G.fleets.some(o => o.sys === f.sys && o.emp === f.emp && fleetArmed(G, o));
    if (friends) continue;
    dead.push(f);
    log(G, f.emp, 'Je ' + D.SHIPS[f.ships[0].t].name.toLowerCase() + ' is vernietigd bij ' + G.systems[f.sys].name + '.', 'combat', f.sys);
    G.anim.booms.push({ sys: f.sys, big: 1 });
    G.empires[f.emp].stats.lost++;
  }
  if (dead.length) G.fleets = G.fleets.filter(f => !dead.includes(f));
}

// ---------- Sieges ----------
function siegePhase(G) {
  for (const s of G.systems) {
    if (s.owner == null) { s.siege = null; continue; }
    const ownerArmed = G.fleets.some(f => f.sys === s.id && f.emp === s.owner && fleetArmed(G, f)) || (s.starbase.level > 0 && s.starbase.hp > 0) || coloniesIn(G, s.id).some(c => c.gar > 0);
    const occ = G.fleets.filter(f => f.sys === s.id && f.emp !== -1 && fleetArmed(G, f) && atWar(G, f.emp, s.owner));
    if (ownerArmed || !occ.length) { s.siege = null; continue; }
    // strongest occupier
    const byEmp = {};
    for (const f of occ) byEmp[f.emp] = (byEmp[f.emp] || 0) + fleetPower(G, f);
    const by = +Object.keys(byEmp).sort((a, b) => byEmp[b] - byEmp[a])[0];
    if (!s.siege || s.siege.emp !== by) s.siege = { emp: by, t: 0 };
    s.siege.t++;
    const cols = coloniesIn(G, s.id);
    const need = (cols.length || s.relay ? D.RULES.siegeTurns : (by === -2 ? 2 : 1)) + (cols.some(c => c.buildings.includes('schild')) ? D.RULES.shieldSiegeBonus : 0);
    s.siege.need = need;
    if (s.siege.t >= need) {
      if (by === -2) devastate(G, s); else captureSystem(G, s, by);
    }
  }
}
function captureSystem(G, s, by) {
  const old = s.owner;
  const eo = G.empires[old], en = G.empires[by];
  s.owner = by;
  s.siege = null;
  s.starbase.level = Math.max(1, s.starbase.level - 1);
  s.starbase.hp = D.STARBASES[s.starbase.level].hp * 0.3;
  const cols = coloniesIn(G, s.id);
  let wasCap = false;
  for (const c of cols) {
    if (c.cap) wasCap = true;
    c.emp = by; c.cap = false; c.pop = Math.max(1, c.pop * 0.75); c.bq = []; c.sq = []; c.gar = garrisonMax(c) * 0.25; c.unrest = 20;
  }
  en.stats.captured++;
  en.rel[old].warScore += cols.length ? 8 : 3;
  eo.rel[by].warScore -= cols.length ? 8 : 3;
  en.known[s.id] = 2;
  // orphaned constructor orders targeting this system
  for (const f of G.fleets) if (f.emp === old && f.order && f.order.target === s.id && f.order.type === 'upgrade') cancelOrder(G, f.id);
  notifyAll(G, en.name + ' verovert ' + s.name + (cols.length ? ' en zijn kolonies' : '') + ' op ' + eo.name + '.', cols.length ? 'war' : 'info', s.id);
  if (wasCap) {
    const rest = coloniesOf(G, old).sort((a, b) => b.pop - a.pop);
    if (rest.length) {
      rest[0].cap = true; eo.capital = rest[0].sys;
      if (!rest[0].buildings.includes('kern')) rest[0].buildings.unshift('kern');
    }
    const oc = cols.find(c => c.buildings.includes('kern'));
    if (oc) oc.buildings = oc.buildings.filter(b => b !== 'kern');
  }
  checkElimination(G, old);
}
function devastate(G, s) {
  const old = s.owner;
  const cols = coloniesIn(G, s.id);
  for (const c of cols) { s.planets[c.pi].colony = null; }
  G.colonies = G.colonies.filter(c => c.sys !== s.id);
  s.owner = null; s.starbase = { level: 0, hp: 0 }; s.siege = null; s.blight = true;
  recomputeDeposits(s);
  notifyAll(G, 'De Leegte heeft ' + s.name + ' verslonden.', 'crisis', s.id);
  if (old != null) checkElimination(G, old);
}
function checkElimination(G, empId) {
  const e = G.empires[empId];
  if (!e.alive || coloniesOf(G, empId).length) return;
  e.alive = false;
  for (const s of G.systems) if (s.owner === empId) { s.owner = null; s.starbase = { level: 0, hp: 0 }; s.siege = null; }
  G.fleets = G.fleets.filter(f => f.emp !== empId);
  for (const o of G.empires) if (o.id !== empId) { o.rel[empId].war = false; e.rel[o.id].war = false; }
  if (G.kroon && G.kroon.emp === empId) G.kroon = null;
  notifyAll(G, e.name + ' is van de sterrenkaart geveegd.', 'big');
}

// ---------- Orders ----------
function orderPhase(G) {
  const remove = [];
  for (const f of G.fleets) {
    if (f.emp < 0 || !f.order || f.path.length) continue;
    const e = G.empires[f.emp];
    const o = f.order;
    if (f.sys !== o.target) { // path got lost
      if (o.type === 'survey' && f.auto) autoExplore(G, f); else { try { moveFleet(G, f.id, o.target, true); } catch (err) { if (err instanceof GameError) cancelOrder(G, f.id); else throw err; } }
      continue;
    }
    const s = G.systems[f.sys];
    if (o.type === 'survey') {
      e.known[s.id] = 2;
      if (s.anomaly) { s.anomaly = false; triggerAnomaly(G, e, s.id); }
      f.order = null;
      if (f.auto) autoExplore(G, f);
    } else if (o.type === 'outpost') {
      if (s.owner != null || G.fleets.some(x => x.sys === s.id && x.emp < 0)) {
        e.res.M += o.paid.M; e.res.I += o.paid.I; f.order = null;
        log(G, e.id, 'Buitenpost bij ' + s.name + ' geannuleerd.', 'info', s.id);
        continue;
      }
      f.prog++;
      if (f.prog >= D.RULES.outpostTurns) {
        s.owner = e.id; s.starbase = { level: 1, hp: D.STARBASES[1].hp };
        f.order = null; f.prog = 0;
        log(G, e.id, 'Buitenpost gebouwd bij ' + s.name + '.', 'build', s.id);
      }
    } else if (o.type === 'upgrade') {
      const nx = D.STARBASES[s.starbase.level + 1];
      if (s.owner !== e.id || !nx) { e.res.M += o.paid.M; f.order = null; continue; }
      f.prog++;
      if (f.prog >= nx.turns) {
        s.starbase.level++; s.starbase.hp = nx.hp; f.order = null; f.prog = 0;
        log(G, e.id, nx.name + ' voltooid bij ' + s.name + '.', 'build', s.id);
      }
    } else if (o.type === 'colonize') {
      const why = (() => { const p = s.planets[o.pi]; if (!p || p.colony) return 1; if (s.owner != null && s.owner !== e.id) return 1; if (G.fleets.some(x => x.sys === s.id && x.emp < 0)) return 1; return 0; })();
      if (why) { f.order = null; log(G, e.id, 'Kolonisatie bij ' + s.name + ' mislukt.', 'info', s.id); continue; }
      const c = { id: G.nextId++, emp: e.id, sys: s.id, pi: o.pi, pop: 1, buildings: [], bq: [], sq: [], cap: false, gar: 20 };
      G.colonies.push(c);
      s.planets[o.pi].colony = c.id;
      if (s.owner == null) { s.owner = e.id; s.starbase = { level: 1, hp: D.STARBASES[1].hp }; }
      remove.push(f);
      log(G, e.id, 'Nieuwe kolonie gesticht op ' + s.planets[o.pi].name + '!', 'colony', s.id);
    }
  }
  if (remove.length) G.fleets = G.fleets.filter(f => !remove.includes(f));
}

// ---------- Economy ----------
function economyPhase(G) {
  for (const e of G.empires) {
    if (!e.alive) continue;
    const inc = computeIncome(G, e);
    e.income = inc;
    e.res.E += inc.E; e.res.M += inc.M; e.res.I += inc.I;
    e.research.progress += inc.R;
    // research
    let guard = 0;
    while (e.research.current && e.research.progress >= techCost(G, e, e.research.current) && guard++ < 3) {
      e.research.progress -= techCost(G, e, e.research.current);
      completeResearch(G, e, e.research.current);
      if (!e.isPlayer) aiChooseResearch(G, e);
    }
    // colonies
    for (const c of G.colonies) {
      if (c.emp !== e.id) continue;
      const mx = colonyMaxPop(G, c);
      if (c.pop < mx) {
        const g = (0.16 + 0.035 * c.pop) * (1 + (e.mods.growth || 0)) * Math.max(0.15, 1 - c.pop / mx);
        c.pop = Math.min(mx, c.pop + g);
      } else if (c.pop > mx) c.pop = Math.max(mx, c.pop - 0.2);
      if (c.unrest > 0) c.unrest--;
      const s = G.systems[c.sys];
      const sieged = s.siege != null;
      if (c.bq.length && !sieged) {
        c.bq[0].left--;
        if (c.bq[0].left <= 0) {
          const b = c.bq.shift().id;
          c.buildings.push(b);
          if (e.isPlayer) log(G, e.id, D.BUILDINGS[b].name + ' voltooid op ' + s.planets[c.pi].name + '.', 'build', c.sys);
        }
      }
      if (c.sq.length && !sieged && c.buildings.includes('werf')) {
        const n = Math.min(c.sq.length, shipyardSlots(G, e));
        for (let i = 0; i < n; i++) c.sq[i].left--;
        const done = c.sq.filter((q, i) => i < n && q.left <= 0);
        c.sq = c.sq.filter(q => !done.includes(q));
        for (const q of done) deliverShip(G, e, c.sys, q.id);
      }
    }
    // edicts tick down
    let edChanged = false;
    for (const id in e.edicts) { if (--e.edicts[id] <= 0) { delete e.edicts[id]; edChanged = true; if (e.isPlayer) log(G, e.id, 'Edict verlopen: ' + D.EDICTS[id].name, 'info'); } }
    if (edChanged) recomputeMods(G, e);
    // energy debt consequences: lose a random building's output is too harsh; instead clamp minerals stock
    if (e.res.E < -50) e.res.E = -50;
    if (e.res.I < 0) e.res.I = 0;
  }
}
function deliverShip(G, e, sysId, t) {
  if (D.SHIPS[t].civ) {
    const f = spawnFleet(G, e.id, sysId, [{ t }]);
    if (t === 'verkenner' && e.isPlayer) { f.auto = true; autoExplore(G, f); }
  } else {
    const host = G.fleets.find(f => f.emp === e.id && f.sys === sysId && !fleetIsCiv(f) && !f.path.length && f.home);
    if (host) host.ships.push({ t, hp: shipStats(G, e.id, t).hp });
    else spawnFleet(G, e.id, sysId, [{ t }], { home: true });
  }
  if (e.isPlayer) log(G, e.id, D.SHIPS[t].name + ' van de werf bij ' + G.systems[sysId].name + '.', 'build', sysId);
}

// ---------- Diplomacy upkeep ----------
function diplomacyPhase(G) {
  for (const e of G.empires) {
    if (!e.alive) continue;
    for (const k in e.rel) {
      const r = e.rel[k];
      r.mod *= 0.985;
      if (r.gifts > 0 && G.turn % 10 === 0) r.gifts--;
    }
  }
}
function contactPhase(G) {
  for (const a of G.empires) {
    if (!a.alive) continue;
    for (const b of G.empires) {
      if (a === b || !b.alive || a.rel[b.id].contact) continue;
      let seen = false;
      for (const sid in a.vis) {
        const s = G.systems[sid];
        if (s.owner === b.id || G.fleets.some(f => f.sys === +sid && f.emp === b.id)) { seen = true; break; }
      }
      if (seen) {
        a.rel[b.id].contact = true; b.rel[a.id].contact = true;
        log(G, a.id, 'Eerste contact met ' + b.name + '.', 'contact');
        log(G, b.id, 'Eerste contact met ' + a.name + '.', 'contact');
        // reveal home
        if (!a.known[b.capital]) a.known[b.capital] = 1;
        if (!b.known[a.capital]) b.known[a.capital] = 1;
      }
    }
  }
}

// ---------- Vision ----------
function updateVision(G, e) {
  const src = [];
  for (const s of G.systems) if (s.owner === e.id) src.push(s.id);
  const fleetSrc = G.fleets.filter(f => f.emp === e.id).map(f => f.sys);
  const range = 1 + (e.mods.vision || 0);
  const d1 = multiBfs(G, src);
  const d2 = multiBfs(G, fleetSrc);
  const vis = {};
  for (let i = 0; i < G.systems.length; i++) {
    if (d1[i] <= range || d2[i] <= 1) { vis[i] = 1; if (!e.known[i]) e.known[i] = 1; }
  }
  e.vis = vis;
}

// ---------- Growing features (e.g. levend erts) ----------
function featureGrowth(G) {
  if (G.turn % D.RULES.oreGrowEvery !== 0) return;
  for (const s of G.systems) for (const f of (s.feats || [])) {
    if (!f.max || f.amt >= f.max) continue;
    f.amt++;
    s.extraDep[f.res] = (s.extraDep[f.res] || 0) + 1;
    recomputeDeposits(s);
    const who = s.owner != null ? s.owner : f.emp;
    if (who != null && who >= 0) log(G, who, f.name + ' bij ' + s.name + ' is gegroeid: nu +' + f.amt + ' ' + D.RES_ICONS[f.res] + (f.amt >= f.max ? ' (maximaal)' : '') + '.', 'event', s.id);
  }
}

// ---------- Random empire events ----------
function randomEvents(G) {
  for (const e of G.empires) {
    if (!e.alive || G.turn < 10) continue;
    if (rnd(G) < 0.04) {
      const ev = pick(G, D.EMPIRE_EVENTS);
      const msg = applyEffects(G, e, ev.fx, null);
      log(G, e.id, ev.title + ' — ' + ev.text + ' (' + msg + ')', 'event');
    }
  }
}

// ---------- Crisis ----------
function crisisPhase(G) {
  const T = D.RULES.crisisTurn;
  if (G.turn === T - 10) notifyAll(G, 'Wetenschappers melden vreemde zwaartekrachtgolven uit de lege ruimte tussen de sterren…', 'crisis');
  if (G.turn === T && !G.crisis) startCrisis(G);
  if (!G.crisis || G.crisis.over) return;
  const C = G.crisis;
  C.timer--;
  if (C.timer <= 0) {
    C.wave++;
    C.timer = D.RULES.crisisWaveEvery;
    C.scale = (C.base || 1) * (1 + 0.07 * Math.min(C.wave, 14)) * D.DIFFICULTY[G.settings.difficulty].crisis;
    for (const rf of G.fleets.filter(f => f.rift)) {
      const n = Math.round(2 + Math.min(C.wave, 12) * 0.7);
      const ships = [];
      for (let i = 0; i < n; i++) ships.push({ t: 'jager' });
      for (let i = 0; i < Math.min(4, Math.floor(C.wave / 3)); i++) ships.push({ t: 'verslinder' });
      spawnFleet(G, -2, rf.sys, ships, { crisis: true });
    }
    notifyAll(G, 'Nieuwe Leegte-vloten stromen uit de scheuren (golf ' + C.wave + ').', 'crisis');
  }
}
function startCrisis(G) {
  const n = { klein: 2, middel: 3, groot: 4 }[G.settings.size];
  const owned = G.systems.filter(s => s.owner != null).map(s => s.id);
  const d = multiBfs(G, owned);
  const capD = multiBfs(G, G.empires.filter(e => e.alive).map(e => e.capital));
  const cand = G.systems.filter(s => !s.relay && !coloniesIn(G, s.id).length && !G.fleets.some(f => f.sys === s.id && f.emp < 0) && capD[s.id] >= 2)
    .sort((a, b) => (b.owner == null) - (a.owner == null) || (d[b.id] + capD[b.id]) - (d[a.id] + capD[a.id]));
  const chosen = [];
  for (const s of cand) {
    if (chosen.length >= n) break;
    if (chosen.some(c => bfsDist(G, c)[s.id] < 3)) continue;
    chosen.push(s.id);
  }
  const alive = G.empires.filter(e => e.alive);
  const avgP = alive.reduce((a, e) => a + empirePower(G, e.id), 0) / Math.max(1, alive.length);
  const base = Math.max(1, Math.min(5, avgP / 1500));
  G.crisis = { wave: 0, timer: 1, base, scale: base * D.DIFFICULTY[G.settings.difficulty].crisis, rifts: chosen.length, over: false };
  if (!chosen.length) { G.crisis.over = true; return; }
  for (const sid of chosen) {
    const rs = G.systems[sid];
    if (rs.owner != null) { log(G, rs.owner, 'Een Leegtescheur verscheurt je buitenpost bij ' + rs.name + '!', 'crisis', sid); rs.owner = null; rs.starbase = { level: 0, hp: 0 }; }
    rs.blight = true; recomputeDeposits(rs);
    spawnFleet(G, -2, sid, [{ t: 'scheur' }], { rift: true, loot: { R: 400, I: 40, E: 300 } });
    for (const e of G.empires) if (e.alive) e.known[sid] = Math.max(e.known[sid] || 0, 1);
  }
  notifyAll(G, 'DE LEEGTE ONTWAAKT. Scheuren in de ruimte openen zich — hetzelfde kwaad dat de Kroon ooit vernietigde.', 'crisis');
}
function onRiftDestroyed(G, empId, f) {
  const C = G.crisis;
  if (!C) return;
  C.rifts--;
  G.empires[empId].rel; // noop
  notifyAll(G, G.empires[empId].name + ' heeft een Leegtescheur gesloten!', 'big', f.sys);
  if (C.rifts <= 0) {
    C.over = true;
    G.fleets = G.fleets.filter(x => x.emp !== -2);
    const e = G.empires[empId];
    e.bonus.R = (e.bonus.R || 0) + 0.1; e.bonus.weapon = (e.bonus.weapon || 0) + 0.1; recomputeMods(G, e);
    notifyAll(G, 'De Leegte is verslagen! ' + e.name + ' wordt geëerd als redder van de nevel (+10% onderzoek en wapens).', 'big');
  }
}
function crisisAI(G) {
  if (!G.crisis || G.crisis.over) return;
  const owned = G.systems.filter(s => s.owner != null).map(s => s.id);
  if (!owned.length) return;
  for (const f of G.fleets) {
    if (f.emp !== -2 || f.rift || f.path.length) continue;
    const s = G.systems[f.sys];
    if (s.owner != null) continue; // sieging
    const d = bfsDist(G, f.sys);
    let best = null, bv = Infinity;
    for (const o of owned) { const v = d[o] + rnd(G) * 1.5; if (v < bv) { bv = v; best = o; } }
    if (best != null) { const p = findPath(G, f.sys, best); if (p) f.path = p.slice(0, 3); }
  }
}

// ---------- Pirates ----------
function raidStrength(G) { return Math.min(10, 2 + Math.floor(G.turn / 18)); }
function pirateAI(G) {
  for (const base of G.fleets.filter(f => f.monster === 'piratenbasis')) {
    if (base.pirTimer == null) base.pirTimer = D.RULES.pirateFirstRaid;
    if (--base.pirTimer > 0) continue;
    base.pirTimer = rint(G, D.RULES.pirateRaidMin, D.RULES.pirateRaidMax);
    if (G.fleets.filter(f => f.raider && f.home === base.id).length >= D.RULES.pirateMaxRaiders) continue;
    const ships = [];
    for (let i = 0; i < raidStrength(G); i++) ships.push({ t: 'piraat' });
    spawnFleet(G, -1, base.sys, ships, { monster: 'rovers', raider: true, home: base.id, homeSys: base.sys, loot: { ...D.MONSTERS.rovers.loot }, raids: 0, wait: 0 });
  }
  for (const f of G.fleets) {
    if (!f.raider || f.path.length) continue;
    const s = G.systems[f.sys];
    const homeAlive = G.fleets.some(b => b.id === f.home);
    if (f.returning) {
      if (f.sys === f.homeSys) {
        if (homeAlive) { f.ships = []; continue; } // back inside the base
        f.returning = false; f.raider = false; continue; // base gone: stays as a roaming band
      }
      const p = findPath(G, f.sys, f.homeSys); if (p) f.path = p.slice(0, 1); else f.returning = false;
      continue;
    }
    if (s.owner != null) { if (++f.wait > 3) f.returning = true; continue; } // busy at a target
    const pw = fleetPower(G, f);
    const d = bfsDist(G, f.sys);
    let best = null, bv = -Infinity;
    for (const t of G.systems) {
      if (t.owner == null || d[t.id] > 5) continue;
      const def = defenseAt(G, t.id, -1);
      if (def > pw * 0.7) continue;
      const v = (coloniesIn(G, t.id).length ? 0 : 3) - d[t.id] + rnd(G);
      if (v > bv) { bv = v; best = t.id; }
    }
    if (best == null) { if (f.sys !== f.homeSys && homeAlive) f.returning = true; continue; }
    const p = findPath(G, f.sys, best);
    if (p) { f.path = p; f.wait = 0; }
  }
  G.fleets = G.fleets.filter(f => f.ships.length > 0);
}
function plunderPhase(G) {
  for (const f of G.fleets) {
    if (!f.raider || f.path.length || f.returning) continue;
    const s = G.systems[f.sys];
    if (s.owner == null) continue;
    const ownerArmed = G.fleets.some(o => o.sys === s.id && o.emp === s.owner && fleetArmed(G, o)) || (s.starbase.level > 0 && s.starbase.hp > 0) || coloniesIn(G, s.id).some(c => c.gar > 0);
    if (ownerArmed) continue;
    const e = G.empires[s.owner];
    const want = Math.round(25 + G.turn * 0.6);
    const tE = Math.max(0, Math.min(want, Math.floor(e.res.E))), tM = Math.max(0, Math.min(want, Math.floor(e.res.M)));
    e.res.E -= tE; e.res.M -= tM;
    f.loot.E = (f.loot.E || 0) + tE; f.loot.M = (f.loot.M || 0) + tM;
    log(G, e.id, 'Piraten plunderen ' + s.name + ': −' + tE + ' energie, −' + tM + ' mineralen.', 'war', s.id);
    if (++f.raids >= 2) f.returning = true;
  }
}

// ---------- Kroon ----------
function kroonPhase(G) {
  if (!G.kroon) return;
  const K = G.kroon;
  if (!G.empires[K.emp].alive || relaysHeld(G, K.emp) < relaysNeeded(G)) {
    notifyAll(G, 'Het ontwaken van de Kroon door ' + G.empires[K.emp].name + ' is onderbroken!', 'big');
    G.kroon = null; return;
  }
  K.left--;
  if (K.left <= 0) {
    G.over = { winner: K.emp, reason: 'kroon' };
    notifyAll(G, 'De Nevelkroon is ontwaakt. ' + G.empires[K.emp].name + ' heerst over de nevel.', 'big');
  }
}

// ---------- Victory ----------
function scoreOf(G, e) {
  if (!e.alive) return 0;
  let pop = 0; for (const c of G.colonies) if (c.emp === e.id) pop += c.pop;
  return systemsOf(G, e.id).length * 5 + pop * 2 + Object.keys(e.techs).length * 8 + (e.repeat || 0) * 8 + empirePower(G, e.id) * 0.15;
}
function victoryCheck(G) {
  if (G.over) return;
  const alive = G.empires.filter(e => e.alive);
  if (G.playerId >= 0 && !G.empires[G.playerId].alive) { G.over = { winner: null, reason: 'dood' }; return; }
  if (alive.length === 1) { G.over = { winner: alive[0].id, reason: 'verovering' }; return; }
  const total = G.systems.length;
  const dom = alive.find(e => systemsOf(G, e.id).length >= total * D.RULES.dominationShare);
  if (G.dom && (!dom || dom.id !== G.dom.emp)) {
    notifyAll(G, 'De overheersing van ' + G.empires[G.dom.emp].name + ' is gebroken.', 'big');
    G.dom = null;
  }
  if (dom && !G.dom) {
    G.dom = { emp: dom.id, left: D.RULES.dominationTurns };
    notifyAll(G, dom.name + ' beheerst ' + Math.round(D.RULES.dominationShare * 100) + '% van de nevel! Houden ze dit ' + D.RULES.dominationTurns + ' beurten vol, dan winnen ze.', 'big');
    for (const o of alive) if (o.id !== dom.id && !o.isPlayer) {
      o.rel[dom.id].contact = dom.rel[o.id].contact = true;
      if (!o.rel[dom.id].war) { setWar(G, o.id, dom.id, true); notifyAll(G, o.name + ' sluit zich aan bij de coalitie tegen ' + dom.name + '.', 'war'); }
    }
  } else if (G.dom) {
    if (--G.dom.left <= 0) { G.over = { winner: G.dom.emp, reason: 'dominantie' }; return; }
  }
  if (G.turn >= D.RULES.turnLimit) {
    const best = alive.sort((a, b) => scoreOf(G, b) - scoreOf(G, a))[0];
    G.over = { winner: best.id, reason: 'score' };
  }
}
