// Headless AI-vs-AI simulation for bugs and balance.
'use strict';
const L = require('../build/logic_node.js');
const seeds = process.argv[2] ? process.argv[2].split(',').map(Number) : [1, 2, 3];
const size = process.argv[3] || 'middel';
const verbose = process.argv.includes('-v');
const results = [];
for (const seed of seeds) {
  const t0 = Date.now();
  const G = L.createGame({ size, ais: 3, difficulty: 'normaal', faction: null, seed, allAI: true });
  // replace pending player events: allAI means none
  let turn = 0;
  while (!G.over && turn < 260) {
    L.processTurn(G);
    G.pending = [];
    turn++;
    if (verbose && (G.turn % 25 === 0)) {
      console.log(`--- seed ${seed} turn ${G.turn}`);
      for (const e of G.empires) {
        const cols = L.coloniesOf(G, e.id);
        const pop = cols.reduce((a, c) => a + c.pop, 0);
        const wars = G.empires.filter(o => o.id !== e.id && e.rel[o.id].war).map(o => o.faction).join(',');
        console.log(`${e.faction.padEnd(7)} alive=${e.alive ? 1 : 0} sys=${String(L.systemsOf(G, e.id).length).padStart(3)} col=${String(cols.length).padStart(2)} pop=${pop.toFixed(0).padStart(4)} pow=${L.empirePower(G, e.id).toFixed(0).padStart(5)} tech=${String(Object.keys(e.techs).length).padStart(2)} E=${e.res.E.toFixed(0).padStart(5)} M=${e.res.M.toFixed(0).padStart(5)} I=${e.res.I.toFixed(0).padStart(4)} inc=${JSON.stringify(e.income)} lost=${e.stats.lost} kill=${e.stats.killed} war=[${wars}]`);
      }
      const neutral = G.systems.filter(s => s.owner == null).length;
      console.log(`neutral systems ${neutral}/${G.systems.length}, monsters ${G.fleets.filter(f => f.emp === -1).length}, crisis ${G.crisis ? JSON.stringify({ w: G.crisis.wave, r: G.crisis.rifts, over: G.crisis.over }) : '-'} kroon ${JSON.stringify(G.kroon)}`);
    }
  }
  const win = G.over ? (G.over.winner != null ? G.empires[G.over.winner].faction : 'none') : 'unfinished';
  results.push({ seed, win, reason: G.over && G.over.reason, turn: G.turn, ms: Date.now() - t0, factions: G.empires.map(e => e.faction).join(',') });
  console.log(`seed ${seed}: winner=${win} reason=${G.over && G.over.reason} turn=${G.turn} (${Date.now() - t0} ms) factions=${G.empires.map(e => e.faction)}`);
}
const tally = {};
for (const r of results) tally[r.win] = (tally[r.win] || 0) + 1;
console.log('TALLY', JSON.stringify(tally));
