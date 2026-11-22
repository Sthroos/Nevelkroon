// ===================== NEVELKROON — computertegenstanders =====================

function aiTurn(G, e) {
  if (!e.research.current) aiChooseResearch(G, e);
  aiMarket(G, e);
  aiEdicts(G, e);
  aiEconomy(G, e);
  aiShipyards(G, e);
  aiCivilians(G, e);
  aiMilitary(G, e);
  aiDiplomacy(G, e);
  if (!canStartKroon(G, e.id)) {
    const myP = empirePower(G, e.id);
    const others = G.empires.filter(o => o.alive && o.id !== e.id).reduce((a, o) => a + empirePower(G, o.id), 0);
    if (myP > others * 0.55 || relaysHeld(G, e.id) > relaysNeeded(G)) startKroon(G, e.id);
  }
}

function aiChooseResearch(G, e) {
  const f = faction(e);
  const relaysKnown = G.relays.some(r => e.known[r]);
  const opt = wpick(G, e.research.options, id => {
    if (id === 'rep') return 0.4;
    const T = D.TECH_BY_ID[id];
    let w = 1;
    if (T.cat === 'en') w += f.aggression;
    if (T.eff.E || T.eff.M || T.eff.R) w += 0.8;
    if (id === 'ph_relay' || id === 'ph_kroon') w += relaysKnown ? 2.5 : 0.5;
    if (['en_frigate', 'en_cruiser', 'en_battleship', 'en_titan'].includes(id)) w += 1 + f.aggression;
    if (id === 'en_starbase') w += 0.6;
    return w;
  });
  if (opt) e.research.current = opt;
}

function aiMarket(G, e) {
  const keepE = canStartKroon(G, e.id) === 'Te weinig energie (' + D.RULES.kroonCostE + ')' || e.techs.ph_kroon ? D.RULES.kroonCostE + 150 : 350;
  if (e.res.E < 20 && e.res.M > 250) marketTrade(G, e.id, 'M', 120);
  else if (e.res.E > keepE + 100) marketTrade(G, e.id, 'E', Math.floor(e.res.E - keepE));
}

function aiEdicts(G, e) {
  if (e.res.I < 90) return;
  const war = atWarAny(G, e);
  const pref = war ? ['oorlog', 'mijnbouw', 'energie'] : (e.income.E < 10 ? ['energie', 'mijnbouw', 'onderzoek'] : ['onderzoek', 'mijnbouw', 'groei', 'energie']);
  for (const id of pref) if (canEdict(G, e.id, id) == null) { enactEdict(G, e.id, id); return; }
}

function atWarAny(G, e) { return G.empires.some(o => o.alive && o.id !== e.id && e.rel[o.id].war); }

function aiEconomy(G, e) {
  const cols = coloniesOf(G, e.id).sort((a, b) => b.pop - a.pop);
  const nWerf = cols.filter(c => c.buildings.includes('werf') || c.bq.some(q => q.id === 'werf')).length;
  const war = atWarAny(G, e);
  for (const c of cols) {
    if (c.bq.length) continue;
    if (usedSlots(c) >= colonySlots(G, c)) continue;
    const mx = colonyMaxPop(G, c);
    const options = Object.keys(D.BUILDINGS).filter(b => canBuild(G, c, b) == null);
    if (!options.length) continue;
    const lowE = e.income.E < 4;
    const b = wpick(G, options, b => {
      switch (b) {
        case 'werf': return nWerf === 0 ? 100 : ((c.cap || (c.pop >= 5 && nWerf < 1 + Math.floor(cols.length / 2))) ? 12 : 0);
        case 'mijn': return lowE ? 0.5 : 3;
        case 'fabriek': return lowE ? 0.5 : 5;
        case 'centrale': return lowE ? 10 : 2;
        case 'reactor': return lowE ? 12 : 3;
        case 'lab': return lowE ? 0.3 : 2.5;
        case 'archief': return lowE ? 0.3 : 4;
        case 'habitat': return c.pop >= mx - 1 ? 5 : 0.5;
        case 'admin': return e.income.I < 5 ? 3 : 0.8;
        case 'schild': return war ? 2.5 : 0.2;
        default: return 1;
      }
    });
    if (!b) continue;
    if (e.res.E - buildingCost(G, e, b) < (b === 'werf' && nWerf === 0 ? 0 : 25)) continue;
    queueBuilding(G, c.id, b);
  }
}

function aiExpansionTargets(G, e) {
  const out = [];
  for (const s of G.systems) {
    if (s.owner != null || e.known[s.id] !== 2) continue;
    if (G.fleets.some(f => f.sys === s.id && f.emp < 0)) continue;
    if (!s.lanes.some(n => G.systems[n].owner === e.id)) continue;
    const habs = s.planets.filter(p => D.HABITABLE.includes(p.type) && !p.colony).length;
    const v = s.dep.E + s.dep.M + s.dep.R * 1.2 + habs * 2.5 + (s.relay ? 10 : 0) + 1;
    out.push({ sys: s.id, v });
  }
  return out;
}
function aiColonyTarget(G, e, excludeSet) {
  let best = null;
  const cap = e.capital;
  const d = bfsDist(G, cap);
  for (const s of G.systems) {
    if (e.known[s.id] !== 2) continue;
    if (s.owner != null && s.owner !== e.id) continue;
    if (s.owner == null && !s.lanes.some(n => G.systems[n].owner === e.id)) continue;
    if (G.fleets.some(f => f.sys === s.id && f.emp < 0)) continue;
    s.planets.forEach((p, pi) => {
      if (!D.HABITABLE.includes(p.type) || p.colony) return;
      if (excludeSet.has(s.id + ':' + pi)) return;
      let hab = D.PLANET_TYPES[p.type].hab + (faction(e).pref === p.type ? 0.2 : 0);
      const v = p.size * hab - d[s.id] * 0.4;
      if (!best || v > best.v) best = { sys: s.id, pi, v };
    });
  }
  return best;
}

function countShips(G, e, t) {
  let n = 0;
  for (const f of G.fleets) if (f.emp === e.id) for (const s of f.ships) if (s.t === t) n++;
  for (const c of G.colonies) if (c.emp === e.id) for (const q of c.sq) if (q.id === t) n++;
  return n;
}
function aiDesiredPower(G, e) {
  const f = faction(e);
  let target = (25 + G.turn * 1.6) * (0.55 + f.aggression * 0.7);
  if (atWarAny(G, e)) target *= 1.5;
  for (const o of G.empires) {
    if (!o.alive || o.id === e.id || !e.rel[o.id].contact) continue;
    if (bordersTouch(G, e.id, o.id) || e.rel[o.id].war) target = Math.max(target, empirePower(G, o.id) * 0.9);
  }
  if (G.crisis && !G.crisis.over) target *= 1.4;
  return target;
}
function aiShipyards(G, e) {
  const yards = coloniesOf(G, e.id).filter(c => c.buildings.includes('werf') && c.sq.length < shipyardSlots(G, e));
  if (!yards.length) return;
  const unsurveyed = G.systems.filter(s => needsSurvey(G, e.id, s.id)).length;
  const expansion = aiExpansionTargets(G, e).length;
  const nSys = systemsOf(G, e.id).length;
  const nCol = coloniesOf(G, e.id).length;
  const wantSci = unsurveyed > 0 ? (G.turn < 60 ? 2 : 1) : 0;
  const wantCon = Math.max(1, expansion > 0 ? Math.min(3, 1 + Math.floor(nSys / 10)) : 1);
  const colTarget = aiColonyTarget(G, e, new Set());
  const wantCol = colTarget && nCol < 3 + G.turn / 12 ? (colTarget.v > 6 ? 2 : 1) : 0;
  const myPower = empirePower(G, e.id);
  const desired = aiDesiredPower(G, e);
  for (const c of yards) {
    const tryQ = (t) => { if (canBuildShip(G, c, t) == null) { queueShip(G, c.id, t); return true; } return false; };
    if (countShips(G, e, 'verkenner') < wantSci && tryQ('verkenner')) continue;
    if (countShips(G, e, 'bouwschip') < wantCon && tryQ('bouwschip')) continue;
    if (countShips(G, e, 'kolonie') < wantCol && tryQ('kolonie')) continue;
    if (e.income.E < 1 && e.res.E < 100) continue;
    const surplus = e.res.M > 160 + 220 * (1 - faction(e).aggression);
    if (myPower >= desired && !surplus) continue;
    const unlocked = D.WARSHIPS.filter(t => !D.SHIPS[t].req || e.techs[D.SHIPS[t].req]);
    const best = unlocked.slice().reverse();
    const t = wpick(G, best, t => {
      const i = best.indexOf(t);
      if (t === 'titaan') return e.res.M > 1300 ? 6 : 0;
      return [4, 2, 1, 0.5, 0.3][i] || 0.3;
    });
    if (t && e.res.M - shipCost(G, e, t) >= 30) tryQ(t);
  }
}

function aiCivilians(G, e) {
  const conTargets = new Set(G.fleets.filter(f => f.emp === e.id && f.order && (f.order.type === 'outpost')).map(f => f.order.target));
  const colTargets = new Set(G.fleets.filter(f => f.emp === e.id && f.order && f.order.type === 'colonize').map(f => f.order.target + ':' + f.order.pi));
  for (const f of G.fleets) {
    if (f.emp !== e.id || !fleetIsCiv(f) || f.order || f.path.length) continue;
    const t = f.ships[0].t;
    try {
      if (t === 'verkenner') { f.auto = true; if (!autoExplore(G, f)) { if (f.sys !== e.capital) moveFleet(G, f.id, e.capital); } }
      else if (t === 'bouwschip') {
        const d = bfsDist(G, f.sys);
        const tg = aiExpansionTargets(G, e).filter(x => !conTargets.has(x.sys) && canOutpost(G, e.id, x.sys) == null)
          .sort((a, b) => (b.v - d[b.sys] * 1.5) - (a.v - d[a.sys] * 1.5))[0];
        if (tg) { orderOutpost(G, f.id, tg.sys); conTargets.add(tg.sys); continue; }
        // starbase upgrades: capital and colonized border systems
        const up = systemsOf(G, e.id).filter(s => canUpgrade(G, e.id, s.id) == null && (coloniesIn(G, s.id).length || s.relay))
          .filter(s => e.res.M - D.STARBASES[s.starbase.level + 1].cost > 150)
          .sort((a, b) => (b.id === e.capital) - (a.id === e.capital) || coloniesIn(G, b.id).length - coloniesIn(G, a.id).length)[0];
        if (up) orderUpgrade(G, f.id, up.id);
      } else if (t === 'kolonie') {
        const tg = aiColonyTarget(G, e, colTargets);
        if (tg) { orderColonize(G, f.id, tg.sys, tg.pi); colTargets.add(tg.sys + ':' + tg.pi); }
      }
    } catch (err) { if (!(err instanceof GameError)) throw err; }
  }
}

function aiMilitary(G, e) {
  // merge idle fleets in the same system
  const bySys = {};
  for (const f of G.fleets) if (f.emp === e.id && !fleetIsCiv(f) && !f.path.length) (bySys[f.sys] = bySys[f.sys] || []).push(f);
  for (const sid in bySys) if (bySys[sid].length > 1) { const m = mergeFleets(G, +sid, e.id); m.home = false; }

  const fleets = G.fleets.filter(f => f.emp === e.id && !fleetIsCiv(f)).sort((a, b) => fleetPower(G, b) - fleetPower(G, a));
  if (!fleets.length) return;
  const main = fleets[0];
  const enemies = G.empires.filter(o => o.alive && o.id !== e.id && e.rel[o.id].war).map(o => o.id);
  const myOwned = systemsOf(G, e.id).map(s => s.id);
  const dHome = multiBfs(G, myOwned);
  const claimed = new Set();

  for (const f of fleets) {
    const s = G.systems[f.sys];
    const pw = fleetPower(G, f);
    // sieging: hold position
    if (s.siege && s.siege.emp === e.id) { f.path = []; continue; }
    // retreat damaged
    let hp = 0, mx = 0;
    for (const sh of f.ships) { hp += sh.hp; mx += shipStats(G, e.id, sh.t).hp; }
    if (hp / mx < 0.4 && s.owner !== e.id) { try { moveFleet(G, f.id, nearestOwned(G, e, f.sys)); } catch (err) { if (!(err instanceof GameError)) throw err; } continue; }
    if (f.path.length && G.turn % 3 !== f.id % 3) continue;
    // small fleets regroup with main
    if (f !== main && pw < fleetPower(G, main) * 0.5 && !main.path.length) {
      if (f.sys !== main.sys) { try { moveFleet(G, f.id, main.sys); } catch (err) { if (!(err instanceof GameError)) throw err; } }
      continue;
    }
    const d = bfsDist(G, f.sys);
    let best = null, bv = 0;
    // defend
    for (const sid of myOwned) {
      const hostiles = G.fleets.filter(o => o.sys === sid && hostile(G, o.emp, e.id) && (o.emp !== -1 || o.raider) && fleetArmed(G, o));
      if (!hostiles.length) continue;
      const hp2 = defenseAt(G, sid, e.id);
      const ownStatic = starbasePower(G, G.systems[sid]) + coloniesIn(G, sid).reduce((a, c) => a + Math.sqrt(Math.max(0, c.gar) * (2 + c.pop * 0.8)), 0);
      if (pw + ownStatic < hp2 * 0.9) continue;
      const v = 20 / (d[sid] + 1);
      if (v > bv && !claimed.has(sid)) { bv = v; best = sid; }
    }
    // attack enemies
    if (best == null && enemies.length) {
      for (const t of G.systems) {
        if (t.owner == null || !enemies.includes(t.owner) || d[t.id] === Infinity) continue;
        const def = defenseAt(G, t.id, e.id);
        if (pw < def * 1.25 + 5) continue;
        const cols = coloniesIn(G, t.id);
        let val = cols.length ? 5 + cols.reduce((a, c) => a + c.pop, 0) / 3 : 1.5;
        if (t.relay) val += 4;
        if (G.kroon && G.kroon.emp === t.owner && t.relay) val += 30;
        if (G.dom && G.dom.emp === t.owner) val += 3;
        if (dHome[t.id] <= 1) val += 1.5;
        const v = val / (d[t.id] + 2);
        if (v > bv) { bv = v; best = t.id; }
      }
    }
    // clear monsters / rifts nearby
    if (best == null) {
      for (const o of G.fleets) {
        if (o.emp >= 0 || d[o.sys] === Infinity || dHome[o.sys] > 3) continue;
        if (o.emp === -2 && !o.rift && G.systems[o.sys].owner == null) continue;
        const def = defenseAt(G, o.sys, e.id);
        if (pw < def * 1.4) continue;
        let val = o.rift ? 8 : (o.monster === 'wachter' ? 6 : o.monster === 'draak' ? 7 : o.monster === 'piratenbasis' ? 5 : 3);
        const v = val / (d[o.sys] + 2);
        if (v > bv && !claimed.has(o.sys)) { bv = v; best = o.sys; }
      }
    }
    if (best == null) {
      const home = e.capital;
      if (f.sys !== home && !f.path.length && s.owner !== e.id) best = home;
      else if (f.sys !== home && f === main && !f.path.length) best = home;
    }
    if (best != null && best !== f.sys) {
      claimed.add(best);
      try { moveFleet(G, f.id, best); } catch (err) { if (!(err instanceof GameError)) throw err; }
    }
  }
}
function nearestOwned(G, e, from) {
  const d = bfsDist(G, from);
  let best = e.capital, bv = Infinity;
  for (const s of G.systems) if (s.owner === e.id && d[s.id] < bv) { bv = d[s.id]; best = s.id; }
  return best;
}

function aiDiplomacy(G, e) {
  const f = faction(e);
  const myP = empirePower(G, e.id);
  const total = G.systems.length;
  for (const o of G.empires) {
    if (!o.alive || o.id === e.id) continue;
    const r = e.rel[o.id];
    if (!r.contact) continue;
    if (r.war) {
      if (G.kroon && G.kroon.emp === o.id) continue;
      if (G.dom && G.dom.emp === o.id) continue;
      const dur = G.turn - r.warSince;
      const satisfied = r.warScore > 18 && dur > 14;
      if (dur > 10 && (satisfied || r.warScore < -10 || myP < empirePower(G, o.id) * 0.7 || dur > 40) && rnd(G) < 0.25) {
        if (o.isPlayer) {
          if (!G.pending.some(p => p.kind === 'peaceOffer' && p.from === e.id)) G.pending.push({ kind: 'peaceOffer', emp: o.id, from: e.id });
        } else if (aiAcceptsPeace(G, o.id, e.id) || (satisfied && r.warScore > 18)) { setWar(G, e.id, o.id, false); notifyAll(G, e.name + ' en ' + o.name + ' sluiten vrede.', 'peace'); }
      }
      continue;
    }
    const op = opinion(G, e.id, o.id);
    const leader = systemsOf(G, o.id).length > total * 0.32;
    if (leader && G.turn > 45 && !r.pact && myP > (empirePower(G, o.id) + 1) * 0.45 && canDeclareWar(G, e.id, o.id) == null) {
      const dogpile = G.empires.some(x => x.alive && x.id !== e.id && x.rel[o.id] && x.rel[o.id].war);
      if (rnd(G) < (dogpile ? 0.2 : 0.06)) { declareWar(G, e.id, o.id); continue; }
    }
    const theirP = empirePower(G, o.id) + 1;
    const ratio = leader ? 1.0 : 1.45;
    const wars = G.empires.filter(x => x.alive && e.rel[x.id] && e.rel[x.id].war).length;
    if (G.turn > 45 && !r.pact && wars === 0 && bordersTouch(G, e.id, o.id) && myP > theirP * ratio && myP > 40 && op < 15 && rnd(G) < f.aggression * 0.07) {
      if (canDeclareWar(G, e.id, o.id) == null) { declareWar(G, e.id, o.id); e.ai.warTarget = o.id; }
      continue;
    }
    if (!r.pact && op > 35 && rnd(G) < 0.04) {
      if (o.isPlayer) {
        if (!G.pending.some(p => p.kind === 'pactOffer' && p.from === e.id)) G.pending.push({ kind: 'pactOffer', emp: o.id, from: e.id });
      } else if (aiAcceptsPact(G, o.id, e.id) && e.res.I >= D.RULES.pactCostI) {
        e.res.I -= D.RULES.pactCostI;
        r.pact = o.rel[e.id].pact = true;
        notifyAll(G, e.name + ' en ' + o.name + ' sluiten een niet-aanvalsverdrag.', 'peace');
      }
    }
  }
}
