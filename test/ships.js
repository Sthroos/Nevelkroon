// Mechanical checks of every ship's properties. Exits non-zero on failure.
'use strict';
const L = require('../build/logic_node.js');
const D = L.D;
let failures = 0;
const check = (ok, msg) => { console.log((ok ? 'OK   ' : 'FAIL ') + msg); if (!ok) failures++; };

function fresh(seed, faction) {
  const G = L.createGame({ size: 'klein', ais: 1, difficulty: 'normaal', faction: faction || 'aurel', seed: seed || 11 });
  G.fleets = G.fleets.filter(f => f.emp === 0 || f.emp === 1); // drop monsters
  return G;
}
function emptySystem(G) {
  return G.systems.find(s => s.owner == null && !G.fleets.some(f => f.sys === s.id)).id;
}
function spawn(G, emp, sys, types) {
  const f = { id: G.nextId++, emp, sys, prev: sys, ships: types.map(t => ({ t, hp: L_stats(G, emp, t).hp })), path: [], order: null, prog: 0, auto: false };
  G.fleets.push(f); return f;
}
const L_stats = (G, emp, t) => ({ hp: Math.round((D.SHIPS[t] || D.MONSTER_SHIPS[t]).hp * (1 + (emp >= 0 ? G.empires[emp].mods.hull : 0))) });
const war = (G) => { G.empires[0].rel[1].war = G.empires[1].rel[0].war = true; G.empires[0].rel[1].contact = G.empires[1].rel[0].contact = true; };
const step = (G) => { G.pending = []; G.empires.forEach(e => { e.research.current = e.research.current || e.research.options[0]; }); L_process(G); };
const L_process = (G) => { const ai = G.empires[1]; ai.isPlayer = true; try { L.processTurn(G); } finally { ai.isPlayer = false; } };

// ---------- Korvet: evasion ----------
{
  let hits = 0, shots = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const G = fresh(seed); war(G);
    const s = emptySystem(G);
    const k = spawn(G, 0, s, Array(20).fill('korvet'));
    const tank = spawn(G, 1, s, ['kruiser']);
    tank.ships[0].hp = 1e6; // survives all 5 rounds so every shot is counted
    const before = k.ships.reduce((a, x) => a + x.hp, 0);
    step(G);
    const kf = G.fleets.find(f => f.id === k.id);
    const after = kf ? kf.ships.reduce((a, x) => a + x.hp, 0) : 0;
    // 1 kruiser, 22 atk, 5 rounds -> expected dmg without evasion ~110, with 30% evasion ~77
    shots += 5; hits += (before - after) / 22;
  }
  const rate = hits / shots;
  check(rate > 0.6 && rate < 0.8, `Korvet ontwijkt ~30% (geraakt ${(rate * 100).toFixed(0)}% van de schoten)`);
}

// ---------- Fregat: shields absorb damage ----------
{
  const G = fresh(3); war(G);
  const s = emptySystem(G);
  const f = spawn(G, 0, s, ['fregat']);
  spawn(G, 1, s, ['korvet']);
  G.empires[1].mods.weapon = 0;
  step(G);
  const fr = G.fleets.find(x => x.id === f.id);
  const maxHp = L_stats(G, 0, 'fregat').hp;
  const lost = fr ? maxHp - fr.ships[0].hp : maxHp;
  // korvet 5 atk x ≤5 rounds = ≤~29 raw; shield 15 absorbs 70% of each hit until empty
  check(fr && lost < 5 * 5 * 1.15 * 0.75, `Fregat-schild vangt schade op (rompverlies ${lost.toFixed(1)} van max ${(5 * 5 * 1.15).toFixed(0)} ruwe schade)`);
}

// ---------- Titaan: fleet aura and uniqueness ----------
{
  const G = fresh(4);
  const e = G.empires[0];
  const withT = L.fleetPower(G, { emp: 0, ships: [{ t: 'kruiser', hp: 110 }, { t: 'titaan', hp: 700 }] });
  const a = (22 + 130), h = 110 + 40 * (1 + e.mods.shield) + 700 + 250 * (1 + e.mods.shield);
  check(Math.abs(withT - Math.sqrt(a * 1.15 * h)) < 1, 'Titaan geeft +15% vlootschade in de krachtberekening');
  e.techs.en_titan = true; e.res.M = 99999;
  const col = G.colonies.find(c => c.emp === 0);
  L.queueShip(G, col.id, 'titaan');
  let blocked = false;
  try { L.queueShip(G, col.id, 'titaan'); } catch (err) { blocked = err instanceof L.GameError; }
  check(blocked, 'Maximaal één titaan (tweede in wachtrij geweigerd)');
  // aura in real combat: same fleet with/without titan vs fixed target, compare damage of kruisers
  let dmgWith = 0, dmgWithout = 0;
  for (let seed = 1; seed <= 30; seed++) {
    for (const withTitan of [true, false]) {
      const H = fresh(seed); war(H);
      const s = emptySystem(H);
      spawn(H, 0, s, withTitan ? ['kruiser', 'kruiser', 'titaan'] : ['kruiser', 'kruiser']);
      const t = spawn(H, -1, s, ['kristalsplinter']); // no shield: measures raw damage
      t.ships[0].hp = 100000;
      step(H);
      const lv = H.fleets.find(x => x.id === t.id);
      const d = 100000 - lv.ships[0].hp;
      if (withTitan) dmgWith += d; else dmgWithout += d;
    }
  }
  // without: 2×22 atk; with: (2×22+130)×1.15. Ratio expected ≈ 4.5
  const ratio = dmgWith / dmgWithout;
  check(ratio > 4.0 && ratio < 5.0, `Titaan-aura werkt in gevecht (schadeverhouding ${ratio.toFixed(2)}, verwacht ≈4,5)`);
}

// ---------- Tech modifiers reach ships ----------
{
  const G = fresh(5);
  const e = G.empires[0];
  const base = L.fleetPower(G, { emp: 0, ships: [{ t: 'kruiser', hp: 110 }] });
  e.techs.ph_lasers = true;
  e.research.options = ['en_armor']; L.chooseResearch(G, 0, 'en_armor'); e.research.progress = 1e6;
  step(G);
  const after = L.fleetPower(G, { emp: 0, ships: [{ t: 'kruiser', hp: 110 }] });
  check(e.techs.en_armor && after > base, `Wapen- en romptechnologie verhogen de scheepskracht (${base.toFixed(0)} → ${after.toFixed(0)})`);
}

// ---------- Movement: speeds ----------
{
  const G = fresh(6);
  const e = G.empires[0];
  const sci = G.fleets.find(f => f.emp === 0 && f.ships[0].t === 'verkenner');
  const kor = G.fleets.find(f => f.emp === 0 && f.ships[0].t === 'korvet');
  G.systems.forEach(x => { if (!e.known[x.id]) e.known[x.id] = 1; });
  const far = G.systems.map(s => s.id).filter(id => {
    const p = L.moveFleet(G, sci.id, id); return p.length >= 4;
  })[0];
  for (const f of [sci, kor]) { L.moveFleet(G, f.id, far); f.order = null; f.auto = false; }
  const s0 = sci.path.length, k0 = kor.path.length;
  step(G);
  check(s0 - sci.path.length === 2, `Verkenner springt 2 stelsels per beurt (${s0 - sci.path.length})`);
  check(k0 - kor.path.length === 1, `Oorlogsvloot springt 1 stelsel per beurt (${k0 - kor.path.length})`);
  check(e.known[sci.sys] === 2 && e.known[kor.sys] === 2, 'Elk schip brengt het stelsel in kaart waar het komt');
}

// ---------- Anomalies only by scouts ----------
{
  const G = fresh(7);
  const e = G.empires[0];
  const kor = G.fleets.find(f => f.emp === 0 && f.ships[0].t === 'korvet');
  const s = G.systems[G.systems[e.capital].lanes[0]];
  s.anomaly = true;
  L.moveFleet(G, kor.id, s.id);
  step(G);
  check(e.known[s.id] === 2 && s.anomaly === true, 'Korvet brengt in kaart maar laat de anomalie liggen');
  const sci = G.fleets.find(f => f.emp === 0 && f.ships[0].t === 'verkenner');
  L.orderSurvey(G, sci.id, s.id);
  let guard = 0; while (s.anomaly && guard++ < 6) step(G);
  check(!s.anomaly && G.pending.some(p => p.kind === 'anomaly'), 'Verkenner onderzoekt de anomalie (gebeurtenis verschijnt)');
}

// ---------- Constructor: outpost and starbase upgrade ----------
{
  const G = fresh(8);
  const e = G.empires[0];
  const con = G.fleets.find(f => f.emp === 0 && f.ships[0].t === 'bouwschip');
  const tgt = G.systems[e.capital].lanes.find(n => G.systems[n].owner == null);
  e.known[tgt] = 2;
  const M0 = e.res.M;
  L.orderOutpost(G, con.id, tgt);
  check(e.res.M === M0 - D.RULES.outpostCostM, 'Buitenpost wordt bij opdracht betaald');
  let guard = 0; while (G.systems[tgt].owner == null && guard++ < 6) step(G);
  check(G.systems[tgt].owner === 0 && G.systems[tgt].starbase.level === 1, `Buitenpost gebouwd (${guard} beurten)`);
  check(G.fleets.includes(con), 'Bouwschip blijft bestaan na het bouwen');
  e.techs.en_starbase = true; e.res.M = 9999;
  L.orderUpgrade(G, con.id, tgt);
  guard = 0; while (G.systems[tgt].starbase.level < 2 && guard++ < 8) step(G);
  check(G.systems[tgt].starbase.level === 2, `Upgrade tot sterrenbasis (${guard} beurten)`);
}

// ---------- Colony ship: colonize and is consumed ----------
{
  const G = fresh(9);
  const e = G.empires[0];
  const col = G.colonies.find(c => c.emp === 0);
  e.res.M = 9999; e.res.I = 99;
  L.queueShip(G, col.id, 'kolonie');
  let guard = 0; while (!G.fleets.some(f => f.emp === 0 && f.ships[0].t === 'kolonie') && guard++ < 8) step(G);
  const ks = G.fleets.find(f => f.emp === 0 && f.ships[0].t === 'kolonie');
  check(!!ks, `Kolonieschip gebouwd (${guard} beurten, ${D.SHIPS.kolonie.turns} verwacht)`);
  let target = null;
  for (const s of G.systems) s.planets.forEach((p, pi) => { if (!target && D.HABITABLE.includes(p.type) && !p.colony && s.owner == null && !G.fleets.some(f => f.sys === s.id && f.emp !== 0)) target = { s, pi }; });
  e.known[target.s.id] = 2;
  const nCol = G.colonies.filter(c => c.emp === 0).length;
  L.orderColonize(G, ks.id, target.s.id, target.pi);
  guard = 0; while (G.fleets.includes(ks) && guard++ < 25) step(G);
  check(G.colonies.filter(c => c.emp === 0).length === nCol + 1 && target.s.owner === 0, 'Kolonie gesticht en stelsel geclaimd');
  check(!G.fleets.includes(ks), 'Kolonieschip is verbruikt');
}

// ---------- Civilians die alone with enemies, survive with escort ----------
{
  const G = fresh(10); war(G);
  const s = emptySystem(G);
  const c1 = spawn(G, 0, s, ['bouwschip']);
  spawn(G, 1, s, ['korvet']);
  step(G);
  check(!G.fleets.includes(c1), 'Burgerschip alleen bij vijand wordt vernietigd');
  const H = fresh(10); war(H);
  const s2 = emptySystem(H);
  const c2 = spawn(H, 0, s2, ['bouwschip']);
  spawn(H, 0, s2, ['kruiser', 'kruiser']);
  spawn(H, 1, s2, ['korvet']);
  step(H);
  check(H.fleets.includes(c2), 'Burgerschip met eigen escorte overleeft');
}

// ---------- Movement stops at hostile, upkeep, repair ----------
{
  const G = fresh(12); war(G);
  const e = G.empires[0];
  const kor = G.fleets.find(f => f.emp === 0 && f.ships[0].t === 'korvet');
  G.systems.forEach(x => { if (!e.known[x.id]) e.known[x.id] = 1; });
  const p = [...L.moveFleet(G, kor.id, G.empires[1].capital)]; // copy: the fleet consumes its own path array
  spawn(G, 1, p[0], ['korvet']);
  step(G);
  check(kor.sys === p[0] || !G.fleets.includes(kor), `Vloot stopt bij vijandelijke schepen (pad ${p.length}, nu ${kor.sys}, stop ${p[0]}, rest ${kor.path.length})`);
  const inc0 = L.computeIncome(G, e).upkeep;
  spawn(G, 0, e.capital, ['slagschip']);
  const inc1 = L.computeIncome(G, e).upkeep;
  check(Math.abs(inc1 - inc0 - D.SHIPS.slagschip.up) < 0.11, `Onderhoud slagschip telt mee (+${(inc1 - inc0).toFixed(1)})`);
  const r = spawn(G, 0, e.capital, ['kruiser']);
  r.ships[0].hp = 10;
  G.empires[0].rel[1].war = G.empires[1].rel[0].war = false;
  step(G);
  check(r.ships[0].hp > 10, `Schade wordt hersteld in eigen gebied (${r.ships[0].hp.toFixed(0)} hp)`);
}

// ---------- Merge / split ----------
{
  const G = fresh(13);
  const e = G.empires[0];
  const a = spawn(G, 0, e.capital, ['fregat', 'fregat']);
  const n = G.fleets.filter(f => f.emp === 0 && f.sys === e.capital && !D.SHIPS[f.ships[0].t].civ).reduce((x, f) => x + f.ships.length, 0);
  const m = L.mergeFleets(G, e.capital, 0);
  check(m.ships.length === n && G.fleets.filter(f => f.emp === 0 && f.sys === e.capital && !D.SHIPS[f.ships[0].t].civ).length === 1, `Samenvoegen: ${n} schepen in één vloot`);
  const b = L.splitFleet(G, m.id);
  check(m.ships.length + b.ships.length === n && b.ships.length > 0, 'Splitsen verdeelt de schepen');
}

console.log(failures ? `\n${failures} controle(s) mislukt` : '\nAlle controles geslaagd');
process.exit(failures ? 1 : 0);
