// Player-path simulation: player empire driven by AI routines + random pending choices.
'use strict';
const L = require('../build/logic_node.js');
const seeds = (process.argv[2] || '1,2,3').split(',').map(Number);
const size = process.argv[3] || 'middel';
const fac = process.argv[4] || null;
const diff = process.argv[5] || 'normaal';
const tally = {};
for (const seed of seeds) {
  const factions = L.D.FACTIONS.map(f => f.id);
  const faction = fac || factions[seed % factions.length];
  const G = L.createGame({ size, ais: 3, difficulty: diff, faction, seed });
  let guard = 0;
  while (!G.over && guard++ < 300) {
    while (G.pending.length) { const p = G.pending[0]; const n = p.kind === "anomaly" ? L.D.ANOMALIES.find(a => a.id === p.id).choices.length : 2; L.resolvePending(G, 0, G.turn % n); }
    L.aiTurn(G, G.empires[0]);
    L.processTurn(G);
  }
  const w = G.over ? (G.over.winner === 0 ? 'PLAYER' : G.over.winner == null ? 'dead' : G.empires[G.over.winner].faction) : 'unfinished';
  tally[w] = (tally[w] || 0) + 1;
  console.log(`seed ${seed} player=${faction} -> ${w} (${G.over && G.over.reason}) turn ${G.turn} kroon=${G.log.filter(l => /Nevelkroon!/.test(l.text)).length} crisisRifts=${G.crisis ? G.crisis.rifts + '/' + G.crisis.over : '-'}`);
}
console.log('TALLY', JSON.stringify(tally));
