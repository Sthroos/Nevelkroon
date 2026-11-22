// ===================== NEVELKROON — interface =====================

const SAVE_KEY = 'nevelkroon_save_v1';
const SET_KEY = 'nevelkroon_settings_v1';
const UI = { G: null, demo: null, me: 0, selSys: null, selFleet: null, busy: false, logIdx: 0, tab: 'overzicht', settings: { music: 0.55, sfx: 0.75, autosave: true }, setup: null, idleCycle: 0, buildCycle: 0 };
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => { const a = Math.abs(n); return (a >= 10000 ? (n / 1000).toFixed(1) + 'k' : a >= 100 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString()); };
const sgn = (n) => (n >= 0 ? '+' : '') + fmt(n);
const RI = (k) => `<span class="r-${k}">${D.RES_ICONS[k]}</span>`;

function store(key, val) { try { localStorage.setItem(key, val); return true; } catch (e) { return false; } }
function load(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }

// ---------- Boot ----------
function boot() {
  rInit($('#map'));
  const s = load(SET_KEY);
  if (s) { try { Object.assign(UI.settings, JSON.parse(s)); } catch (e) { /* ignore corrupt settings */ } }
  AudioFX.setVolume('music', UI.settings.music); AudioFX.setVolume('sfx', UI.settings.sfx);
  setupInput();
  document.addEventListener('click', onAction);
  document.addEventListener('keydown', onKey);
  $('#modal').addEventListener('click', (ev) => { if (ev.target.id === 'modal' && (!UI.G || !UI.G.over)) closeModal(); });
  const unlock = () => { AudioFX.startMusic(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);
  showTitle();
  requestAnimationFrame(loop);
}
function loop(now) {
  const G = UI.G || UI.demo;
  if (!UI.G && UI.demo) {
    const t = now / 1000;
    R.cam.x = UI.demo.w / 2 + Math.cos(t * 0.05) * UI.demo.w * 0.18;
    R.cam.y = UI.demo.h / 2 + Math.sin(t * 0.05) * UI.demo.h * 0.14;
    R.cam.z = Math.max(0.35, Math.min(R.W / UI.demo.w, R.H / UI.demo.h) * 1.25);
  }
  rDraw(G, now);
  requestAnimationFrame(loop);
}

// ---------- Title & setup ----------
function showTitle() {
  if (!UI.demo) {
    UI.demo = createGame({ size: 'middel', ais: 3, difficulty: 'normaal', faction: null, seed: (Math.random() * 1e9) | 0, allAI: true });
    for (let i = 0; i < 70 && !UI.demo.over; i++) { processTurn(UI.demo); UI.demo.pending = []; }
    UI.demo.anim = null;
  }
  R.viewer = -1; R.selSys = R.selFleet = null; R.terrKey = '';
  $('#hud').classList.add('hidden');
  const hasSave = !!load(SAVE_KEY);
  $('#title').classList.remove('hidden');
  $('#title').innerHTML = `
    <div>
      <h1 class="logo">NEVELKROON</h1>
      <div class="sub">Een galactische strategie in beurten</div>
      <p class="lore">Duizend jaar geleden viel de Kroon stil: het netwerk van relais dat de Ardennevel bijeenhield. Nu zoemen de relais weer. Vijf beschavingen reiken tegelijk naar de sterren. Wie de Kroon wekt, heerst over de nevel. Maar iets in de leegte heeft haar ooit doen vallen…</p>
      <div class="menu">
        ${hasSave ? '<button class="btn primary" data-act="continue">Doorgaan</button>' : ''}
        <button class="btn ${hasSave ? '' : 'primary'}" data-act="newgame">Nieuw spel</button>
        <button class="btn" data-act="help">Hoe speel je?</button>
        <button class="btn" data-act="settings">Instellingen</button>
      </div>
      <p class="dim tiny" style="text-align:center;margin-top:20px">Tip: gebruik een koptelefoon. De muziek wordt live gegenereerd.</p>
    </div>`;
}
function showSetup() {
  UI.setup = UI.setup || { faction: 'aurel', size: 'middel', ais: 3, difficulty: 'normaal', name: '' };
  const S = UI.setup;
  $('#title').innerHTML = `
    <div class="setup">
      <div class="mhead"><h2>Kies je beschaving</h2><button class="btn small close" data-act="title">← Terug</button></div>
      <div class="cards">
        ${D.FACTIONS.map(f => `
          <button class="card fcard ${S.faction === f.id ? 'sel' : ''}" data-act="setfac" data-id="${f.id}">
            <div class="row"><div class="emblem" style="background:${f.color}">${f.name[0]}</div><h3 class="grow">${esc(f.name)}</h3></div>
            <p class="small dim" style="margin:8px 0 0">${esc(f.desc)}</p>
            <ul>${f.traits.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
          </button>`).join('')}
      </div>
      <div class="opts">
        <div class="col"><b>Naam van je rijk</b><input type="text" id="empName" maxlength="32" placeholder="${esc(D.FACTIONS.find(f => f.id === S.faction).name)}" value="${esc(S.name)}"></div>
        <div class="col"><b>Grootte van de nevel</b><div class="seg">${Object.entries(D.GALAXY_SIZES).map(([k, v]) => `<button class="${S.size === k ? 'on' : ''}" data-act="setopt" data-k="size" data-v="${k}">${v.name} (${v.n})</button>`).join('')}</div></div>
        <div class="col"><b>Tegenstanders</b><div class="seg">${[1, 2, 3, 4].map(n => `<button class="${S.ais === n ? 'on' : ''}" data-act="setopt" data-k="ais" data-v="${n}">${n}</button>`).join('')}</div></div>
        <div class="col"><b>Moeilijkheid</b><div class="seg">${Object.entries(D.DIFFICULTY).map(([k, v]) => `<button class="${S.difficulty === k ? 'on' : ''}" data-act="setopt" data-k="difficulty" data-v="${k}">${v.name}</button>`).join('')}</div></div>
      </div>
      <div class="row"><span class="dim small grow">Winnen: wek de Kroon, beheers 60% van de nevel, verover alle rivalen, of heb de hoogste score na ${D.RULES.turnLimit} beurten.</span><button class="btn primary" data-act="start" style="padding:12px 26px;font-size:16px">Start ▶</button></div>
    </div>`;
  const inp = $('#empName');
  inp.addEventListener('input', () => { S.name = inp.value; });
}
function startGame() {
  const S = UI.setup;
  const name = (S.name || '').trim().slice(0, 32);
  UI.G = createGame({ size: S.size, ais: S.ais, difficulty: S.difficulty, faction: S.faction, seed: (Math.random() * 2 ** 31) | 0, empireName: name || null });
  enterGame();
  const e = UI.G.empires[0];
  setTimeout(() => openModal(`
    <div class="mhead"><div class="emblem" style="background:${e.color}">${esc(e.name[0])}</div><h2>${esc(e.name)}</h2></div>
    <p>Je thuiswereld <b>${esc(UI.G.systems[e.capital].planets[0].name)}</b> heeft zojuist zijn eerste hyperdrive getest. Je verkenners staan klaar, je bouwschip wacht op orders.</p>
    <ul class="small">
      <li><b>Verken</b>: je verkenners gaan automatisch op pad. Tik op een schip en daarna op een stelsel om het te sturen.</li>
      <li><b>Breid uit</b>: stuur je bouwschip naar een verkend stelsel en bouw een buitenpost.</li>
      <li><b>Koloniseer</b>: bouw een kolonieschip op je werf en vestig je op bewoonbare planeten.</li>
      <li><b>Onderzoek</b>: kies elke keer een van drie technologieën.</li>
      <li>Rond beurt ${D.RULES.crisisTurn} ontwaakt er iets in de leegte. Wees voorbereid.</li>
    </ul>
    <div class="row"><span class="grow"></span><button class="btn primary" data-act="closeModal">Naar de sterren</button></div>`, 'narrow'), 300);
}
function enterGame() {
  const G = UI.G;
  UI.me = G.playerId;
  R.viewer = UI.me; R.terrKey = ''; R.bgFor = null; R.fx = []; R.anim = null;
  UI.selSys = UI.selFleet = null;
  UI.logIdx = G.log.length;
  $('#title').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  const cap = G.systems[G.empires[UI.me].capital];
  R.cam.x = cap.x; R.cam.y = cap.y; R.cam.z = 1.0;
  refresh();
  AudioFX.startMusic();
}

// ---------- Save / load ----------
function saveGame() {
  if (!UI.G) return false;
  const G = UI.G; const anim = G.anim; G.anim = null;
  const ok = store(SAVE_KEY, JSON.stringify(G));
  G.anim = anim;
  return ok;
}
function restore(json) {
  const G = JSON.parse(json);
  if (!G || G.version !== 1 || !Array.isArray(G.systems) || !Array.isArray(G.empires)) throw new Error('Ongeldig opslagbestand');
  for (const e of G.empires) recomputeMods(G, e);
  G.anim = null;
  return G;
}
function continueGame() {
  const raw = load(SAVE_KEY);
  if (!raw) return toast('Geen opgeslagen spel gevonden', 'err');
  try { UI.G = restore(raw); } catch (e) { return toast('Opslag is beschadigd', 'err'); }
  enterGame();
  if (UI.G.pending.length) showPending();
}

// ---------- Input ----------
function setupInput() {
  const cv = $('#map');
  const ptrs = new Map();
  let drag = null, pinch = null, moved = false;
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = false;
    if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, cx: R.cam.x, cy: R.cam.y };
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: R.cam.z, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      drag = null;
    }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) {
      if (UI.G) R.hoverSys = rPickSystem(UI.G, e.clientX, e.clientY);
      return;
    }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt(pinch.mx, pinch.my, pinch.z * d / pinch.d, true);
      moved = true;
    } else if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) { moved = true; cv.classList.add('drag'); }
      if (moved) { R.target = null; R.cam.x = drag.cx - dx / R.cam.z; R.cam.y = drag.cy - dy / R.cam.z; clampCam(); }
    }
  });
  const up = (e) => {
    const wasTap = ptrs.size === 1 && !moved && drag;
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (ptrs.size === 0) { drag = null; cv.classList.remove('drag'); }
    if (wasTap) onTap(e.clientX, e.clientY);
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); drag = null; pinch = null; });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, R.cam.z * Math.pow(1.0015, -e.deltaY)); }, { passive: false });
  cv.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!UI.G || UI.busy || UI.selFleet == null) return;
    const sid = rPickSystem(UI.G, e.clientX, e.clientY);
    if (sid != null) fleetToSystem(sid, true);
  });
}
function zoomAt(sx, sy, z, noTarget) {
  if (!UI.G) return;
  z = Math.max(0.25, Math.min(2.6, z));
  const [wx, wy] = s2w(sx, sy);
  R.cam.z = z;
  const [wx2, wy2] = s2w(sx, sy);
  R.cam.x += wx - wx2; R.cam.y += wy - wy2;
  if (!noTarget) R.target = null;
  clampCam();
}
function clampCam() {
  const G = UI.G; if (!G) return;
  R.cam.x = Math.max(-200, Math.min(G.w + 200, R.cam.x));
  R.cam.y = Math.max(-200, Math.min(G.h + 200, R.cam.y));
}
function onTap(x, y) {
  const G = UI.G;
  if (!G || UI.busy) return;
  const fid = rPickFleet(x, y, UI.me);
  const sid = rPickSystem(G, x, y);
  if (UI.selFleet != null && sid != null) {
    const f = G.fleets.find(f => f.id === UI.selFleet);
    if (f && fid === f.id) { selectSystem(f.sys); return; }
    if (f && (fid == null || G.fleets.find(x => x.id === fid).sys !== f.sys)) { fleetToSystem(sid, false); return; }
  }
  if (fid != null) { selectFleet(fid); return; }
  if (sid != null) { selectSystem(sid); return; }
  deselect();
}
function onKey(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'Escape') { if (!$('#modal').classList.contains('hidden')) closeModal(); else deselect(); return; }
  if (!UI.G || !$('#modal').classList.contains('hidden')) return;
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); endTurn(); }
  else if (e.key === 'r') showResearch();
  else if (e.key === 'd') showDiplomacy();
  else if (e.key === 'e') showEmpire();
  else if (e.key === 'l') showLog();
  else if (e.key === 'h') focusCapital();
}

// ---------- Selection ----------
function selectSystem(sid) {
  UI.selSys = sid; UI.selFleet = null; R.selSys = sid; R.selFleet = null;
  AudioFX.sfx('select');
  renderPanel();
}
function selectFleet(fid) {
  const f = UI.G.fleets.find(x => x.id === fid);
  if (!f) return;
  UI.selFleet = fid; UI.selSys = null; R.selFleet = fid; R.selSys = null;
  AudioFX.sfx('select');
  renderPanel();
}
function deselect() {
  UI.selSys = UI.selFleet = null; R.selSys = R.selFleet = null;
  renderPanel();
}
function focusSys(sid, z) {
  const s = UI.G.systems[sid];
  const zz = z || Math.max(R.cam.z, 0.9);
  const mobileSheet = window.innerWidth <= 760 && (UI.selSys != null || UI.selFleet != null);
  const deskPanel = window.innerWidth > 760 && (UI.selSys != null || UI.selFleet != null);
  rFocus(s.x + (deskPanel ? 180 / zz : 0), s.y + (mobileSheet ? R.H * 0.24 / zz : 0), zz);
}
function focusCapital() { focusSys(UI.G.empires[UI.me].capital, 1); }

/** Selected fleet + tapped system → contextual order. */
function fleetToSystem(sid, direct) {
  const G = UI.G;
  const f = G.fleets.find(x => x.id === UI.selFleet);
  if (!f || f.emp !== UI.me) return;
  const e = G.empires[UI.me];
  const t = f.ships[0].t;
  const civ = fleetIsCiv(f);
  if (!civ) {
    const def = e.vis[sid] ? defenseAt(G, sid, UI.me) : 0;
    const pw = fleetPower(G, f);
    if (def > pw * 0.9) {
      UI.confirmCb = () => act(() => { moveFleet(G, f.id, sid); AudioFX.sfx('move'); });
      openModal(`<h3>Gevaarlijke aanval</h3><p class="small">De verdediging bij ${esc(G.systems[sid].name)} heeft sterkte <b class="neg">${fmt(def)}</b>, jouw vloot <b>${fmt(pw)}</b>. Je verliest waarschijnlijk.</p><div class="row"><span class="grow"></span><button class="btn" data-act="closeModal">Annuleren</button><button class="btn danger" data-act="confirmYes">Toch gaan</button></div>`, 'narrow');
      return;
    }
  }
  if (!civ || direct) return act(() => { moveFleet(G, f.id, sid); AudioFX.sfx('move'); });
  const opts = [];
  if (t === 'verkenner' && e.known[sid] !== 2) opts.push({ label: 'Verken ' + G.systems[sid].name, run: () => orderSurvey(G, f.id, sid) });
  if (t === 'bouwschip') {
    const w = canOutpost(G, UI.me, sid);
    if (G.systems[sid].owner == null) opts.push({ label: `Bouw buitenpost (${D.RULES.outpostCostM}${D.RES_ICONS.M} ${outpostCostI(G, e)}${D.RES_ICONS.I})`, run: () => orderOutpost(G, f.id, sid), why: w });
    if (G.systems[sid].owner === UI.me && D.STARBASES[G.systems[sid].starbase.level + 1]) {
      const nx = D.STARBASES[G.systems[sid].starbase.level + 1];
      opts.push({ label: `Upgrade tot ${nx.name} (${nx.cost}${D.RES_ICONS.M})`, run: () => orderUpgrade(G, f.id, sid), why: canUpgrade(G, UI.me, sid) });
    }
  }
  if (t === 'kolonie') {
    G.systems[sid].planets.forEach((p, pi) => {
      if (!D.HABITABLE.includes(p.type) || p.colony) return;
      if (e.known[sid] !== 2) return;
      opts.push({ label: `Koloniseer ${p.name} (${D.PLANET_TYPES[p.type].name}, ${estMaxPop(G, UI.me, p)} pop)`, run: () => orderColonize(G, f.id, sid, pi), why: canColonize(G, UI.me, sid, pi) });
    });
  }
  if (!opts.length) return act(() => { moveFleet(G, f.id, sid); AudioFX.sfx('move'); });
  opts.push({ label: 'Alleen verplaatsen', run: () => moveFleet(G, f.id, sid) });
  UI.ctxOpts = opts;
  openModal(`<div class="mhead"><h2>${esc(D.SHIPS[t].name)} → ${esc(G.systems[sid].name)}</h2><button class="btn small close" data-act="closeModal">✕</button></div>
    <div class="col">${opts.map((o, i) => `<button class="btn ${i === 0 && !o.why ? 'primary' : ''}" data-act="ctx" data-i="${i}" ${o.why ? 'disabled' : ''}>${esc(o.label)}${o.why ? ` <span class="tiny">(${esc(o.why)})</span>` : ''}</button>`).join('')}</div>`, 'narrow');
}
function estMaxPop(G, empId, p) {
  const e = G.empires[empId];
  let hab = D.PLANET_TYPES[p.type].hab + (faction(e).pref === p.type ? 0.2 : 0);
  return Math.max(2, Math.round(p.size * hab * (1 + e.mods.maxPop)));
}

// ---------- Generic action wrapper ----------
function act(fn) {
  try { const r = fn(); refresh(); return r; }
  catch (err) {
    if (err instanceof GameError) { toast(err.message, 'err'); AudioFX.sfx('error'); return undefined; }
    throw err;
  }
}

function onAction(ev) {
  const b = ev.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const a = b.dataset.act, d = b.dataset;
  const G = UI.G;
  AudioFX.init();
  switch (a) {
    case 'newgame': AudioFX.sfx('click'); showSetup(); break;
    case 'continue': AudioFX.sfx('click'); continueGame(); break;
    case 'title': AudioFX.sfx('click'); showTitle(); break;
    case 'setfac': UI.setup.faction = d.id; AudioFX.sfx('select'); showSetup(); break;
    case 'setopt': UI.setup[d.k] = d.k === 'ais' ? +d.v : d.v; AudioFX.sfx('click'); showSetup(); break;
    case 'start': AudioFX.sfx('colony'); startGame(); break;
    case 'help': showHelp(); break;
    case 'settings': showSettings(); break;
    case 'closeModal': closeModal(); break;
    case 'close': deselect(); break;
    case 'endturn': endTurn(); break;
    case 'selsys': closeModal(); selectSystem(+d.id); focusSys(+d.id); break;
    case 'selfleet': closeModal(); selectFleet(+d.id); { const f = G.fleets.find(x => x.id === +d.id); if (f) focusSys(f.sys); } break;
    case 'build': act(() => { queueBuilding(G, +d.col, d.b); AudioFX.sfx('build'); }); break;
    case 'ship': act(() => { queueShip(G, +d.col, d.t); AudioFX.sfx('build'); }); break;
    case 'cancelq': act(() => cancelQueue(G, +d.col, d.kind, +d.idx)); break;
    case 'ctx': { const o = UI.ctxOpts[+d.i]; closeModal(); act(() => { o.run(); AudioFX.sfx('move'); }); break; }
    case 'quick': fleetQuick(d.kind, +d.fleet, d.sys != null ? +d.sys : null, d.pi != null ? +d.pi : null); break;
    case 'auto': act(() => setAuto(G, +d.fleet, d.on === '1')); break;
    case 'stop': act(() => cancelOrder(G, +d.fleet)); break;
    case 'merge': act(() => { const m = mergeFleets(G, +d.sys, UI.me); selectFleet(m.id); }); break;
    case 'split': act(() => splitFleet(G, +d.fleet)); break;
    case 'home': act(() => moveFleet(G, +d.fleet, G.empires[UI.me].capital)); break;
    case 'research': showResearch(); break;
    case 'pickTech': act(() => { chooseResearch(G, UI.me, d.id); AudioFX.sfx('select'); }); closeModal(); break;
    case 'diplo': showDiplomacy(); break;
    case 'war': confirmBox(`Oorlog verklaren aan ${G.empires[+d.emp].name}?`, () => act(() => { declareWar(G, UI.me, +d.emp); AudioFX.sfx('war'); showDiplomacy(); })); break;
    case 'peace': act(() => { const ok = proposePeace(G, UI.me, +d.emp); toast(ok ? 'Vrede gesloten!' : 'Ze weigeren je vredesvoorstel.', ok ? 'peace' : 'war'); AudioFX.sfx(ok ? 'peace' : 'error'); showDiplomacy(); }); break;
    case 'pact': act(() => { const ok = proposePact(G, UI.me, +d.emp); toast(ok ? 'Niet-aanvalsverdrag gesloten.' : 'Ze wijzen je verdrag af.', ok ? 'peace' : 'info'); AudioFX.sfx(ok ? 'peace' : 'error'); showDiplomacy(); }); break;
    case 'unpact': act(() => { cancelPact(G, UI.me, +d.emp); showDiplomacy(); }); break;
    case 'gift': act(() => { sendGift(G, UI.me, +d.emp); AudioFX.sfx('click'); showDiplomacy(); }); break;
    case 'empire': showEmpire(d.tab); break;
    case 'tab': showEmpire(d.tab); break;
    case 'edict': act(() => { enactEdict(G, UI.me, d.id); AudioFX.sfx('build'); showEmpire('edicten'); }); break;
    case 'trade': act(() => { marketTrade(G, UI.me, d.from, +d.amt); AudioFX.sfx('click'); showEmpire('markt'); }); break;
    case 'kroon': confirmBox('De Kroon wekken? Alle andere rijken zullen je de oorlog verklaren.', () => act(() => { startKroon(G, UI.me); AudioFX.sfx('crisis'); closeModal(); })); break;
    case 'log': showLog(); break;
    case 'menu': showMenu(); break;
    case 'choice': { const r = act(() => resolvePending(G, +d.idx, +d.ch)); closeModal(); if (r) toast(r, 'event'); if (G.pending.length) setTimeout(showPending, 200); break; }
    case 'focuscap': focusCapital(); break;
    case 'zoomin': zoomAt(R.W / 2, R.H / 2, R.cam.z * 1.3); break;
    case 'zoomout': zoomAt(R.W / 2, R.H / 2, R.cam.z / 1.3); break;
    case 'cycleIdle': cycleIdle(); break;
    case 'cycleBuild': cycleBuild(); break;
    case 'showPending': showPending(); break;
    case 'save': { const ok = saveGame(); toast(ok ? 'Spel opgeslagen' : 'Opslaan mislukt (opslag vol of geblokkeerd)', ok ? 'info' : 'err'); break; }
    case 'quit': saveGame(); UI.G = null; closeModal(); showTitle(); break;
    case 'export': showExport(); break;
    case 'import': doImport(); break;
    case 'copyExport': { const t = $('#expTxt').value; try { navigator.clipboard.writeText(t).then(() => toast('Gekopieerd naar klembord', 'info'), () => { $('#expTxt').select(); toast('Selecteer en kopieer handmatig', 'info'); }); } catch (e) { $('#expTxt').select(); toast('Selecteer en kopieer handmatig', 'info'); } break; }
    case 'confirmYes': { const cb = UI.confirmCb; UI.confirmCb = null; closeModal(); if (cb) cb(); break; }
    case 'newFromEnd': UI.G = null; store(SAVE_KEY, ''); closeModal(); showSetup(); $('#title').classList.remove('hidden'); $('#hud').classList.add('hidden'); break;
    case 'toggleAutosave': UI.settings.autosave = !UI.settings.autosave; store(SET_KEY, JSON.stringify(UI.settings)); showSettings(); break;
    default: break;
  }
}
function fleetQuick(kind, fid, sid, pi) {
  const G = UI.G;
  act(() => {
    if (kind === 'outpost') orderOutpost(G, fid, sid);
    else if (kind === 'upgrade') orderUpgrade(G, fid, sid);
    else if (kind === 'colonize') orderColonize(G, fid, sid, pi);
    else if (kind === 'survey') orderSurvey(G, fid, sid);
    AudioFX.sfx('move');
  });
}
function confirmBox(text, cb) {
  UI.confirmCb = cb;
  openModal(`<h3 style="margin-bottom:14px">${esc(text)}</h3><div class="row"><span class="grow"></span><button class="btn" data-act="closeModal">Annuleren</button><button class="btn danger" data-act="confirmYes">Bevestigen</button></div>`, 'narrow');
}

// ---------- Refresh ----------
function refresh() {
  if (!UI.G) return;
  const G = UI.G;
  if (UI.selFleet != null && !G.fleets.some(f => f.id === UI.selFleet)) { UI.selFleet = null; R.selFleet = null; }
  const e = G.empires[UI.me];
  e.income = computeIncome(G, e);
  renderTop();
  renderPanel();
  renderChips();
  renderBanners();
}
function renderTop() {
  const G = UI.G, e = G.empires[UI.me];
  const inc = e.income;
  const R0 = e.research;
  const cur = R0.current;
  const cost = cur ? techCost(G, e, cur) : 0;
  const pct = cur ? Math.min(100, R0.progress / cost * 100) : 0;
  const turns = cur && inc.R > 0 ? Math.max(1, Math.ceil((cost - R0.progress) / inc.R)) : '–';
  $('#top').innerHTML = `
    <div class="res">
      ${D.RES_KEYS.map(k => `<div class="r" title="${D.RES_NAMES[k]}: ${fmt(k === 'R' ? R0.progress : e.res[k])}, netto ${sgn(inc[k])} per beurt${k === 'E' ? ' (onderhoud ' + fmt(inc.upkeep) + ')' : ''}"><span class="ic r-${k}">${D.RES_ICONS[k]}</span><b class="${k !== 'R' && e.res[k] < 0 ? 'neg' : ''}">${fmt(k === 'R' ? inc.R : e.res[k])}</b><span class="inc ${inc[k] < 0 ? 'neg' : 'dim'}">${k === 'R' ? '/beurt' : sgn(inc[k])}</span></div>`).join('')}
    </div>
    <div id="turnlbl">Beurt ${G.turn}</div>
    <button class="btn" id="researchBtn" data-act="research">${cur ? `◈ ${esc(D.TECH_BY_ID[cur] ? D.TECH_BY_ID[cur].name : 'Doorbraak')} <span class="dim tiny">${turns} b.</span>` : '<span style="color:var(--gold)">◈ Kies onderzoek!</span>'}<div class="bar blue"><i style="width:${pct}%"></i></div></button>
    <div id="topBtns">
      <button class="btn icon" data-act="diplo" title="Diplomatie (D)">⚑</button>
      <button class="btn icon" data-act="empire" title="Rijk (E)">♛</button>
      <button class="btn icon" data-act="log" title="Logboek (L)">☰</button>
      <button class="btn icon" data-act="menu" title="Menu">⚙</button>
    </div>`;
}
function renderChips() {
  const G = UI.G, e = G.empires[UI.me];
  const chips = [];
  if (G.pending.some(p => p.emp === UI.me)) chips.push(`<div class="chip warn" data-act="showPending">✉ ${G.pending.filter(p => p.emp === UI.me).length} gebeurtenis(sen)</div>`);
  if (!e.research.current) chips.push(`<div class="chip warn" data-act="research">◈ Kies onderzoek</div>`);
  const idle = idleShips();
  if (idle.length) chips.push(`<div class="chip" data-act="cycleIdle">⛭ ${idle.length} schip${idle.length > 1 ? 'en' : ''} zonder opdracht</div>`);
  const bc = buildableColonies();
  if (bc.length) chips.push(`<div class="chip" data-act="cycleBuild">⌂ ${bc.length} kolonie${bc.length > 1 ? 's' : ''} kan bouwen</div>`);
  $('#chips').innerHTML = chips.join('');
  $('#endturn').innerHTML = `<div><big>${G.turn}</big>Volgende<br>beurt</div>`;
  $('#endturn').disabled = UI.busy;
}
function idleShips() {
  const G = UI.G;
  return G.fleets.filter(f => f.emp === UI.me && fleetIsCiv(f) && !f.order && !f.path.length && !f.auto);
}
function buildableColonies() {
  const G = UI.G;
  return coloniesOf(G, UI.me).filter(c => !c.bq.length && Object.keys(D.BUILDINGS).some(b => canBuild(G, c, b) == null));
}
function cycleIdle() {
  const l = idleShips(); if (!l.length) return;
  const f = l[UI.idleCycle++ % l.length];
  selectFleet(f.id); focusSys(f.sys);
}
function cycleBuild() {
  const l = buildableColonies(); if (!l.length) return;
  const c = l[UI.buildCycle++ % l.length];
  selectSystem(c.sys); focusSys(c.sys);
}
function renderBanners() {
  const G = UI.G;
  const b = [];
  if (G.crisis && !G.crisis.over && G.crisis.rifts > 0) b.push(`<div class="banner">☠ De Leegte: ${G.crisis.rifts} scheur${G.crisis.rifts > 1 ? 'en' : ''} open, golf ${G.crisis.wave}</div>`);
  if (G.kroon) b.push(`<div class="banner kroon">✧ ${esc(G.empires[G.kroon.emp].name)} wekt de Kroon: nog ${G.kroon.left} beurten</div>`);
  if (G.dom) b.push(`<div class="banner dom">♛ ${esc(G.empires[G.dom.emp].name)} overheerst de nevel: nog ${G.dom.left} beurten</div>`);
  $('#banners').innerHTML = b.join('');
}

// ---------- Panel ----------
function renderPanel() {
  const p = $('#panel');
  const G = UI.G;
  if (!G || (UI.selSys == null && UI.selFleet == null)) { p.classList.add('hidden'); document.body.classList.remove('panel-open'); return; }
  p.classList.remove('hidden'); document.body.classList.add('panel-open');
  const st = p.scrollTop;
  p.innerHTML = UI.selFleet != null ? fleetPanel(G.fleets.find(f => f.id === UI.selFleet)) : systemPanel(UI.selSys);
  p.scrollTop = st;
}
function ownerTag(G, o) {
  if (o == null) return '<span class="tag">Onbezet</span>';
  const e = G.empires[o];
  return `<span class="tag" style="border-color:${e.color};color:${e.color}">${esc(e.name)}</span>`;
}
function planetBall(p) { const PT = D.PLANET_TYPES[p.type]; return `<div class="pball" style="background:radial-gradient(circle at 35% 35%, ${PT.color}, ${PT.color2})"></div>`; }
function depText(dep) {
  const parts = ['E', 'M', 'R'].filter(k => dep[k]).map(k => `${RI(k)} ${dep[k]}`);
  return parts.length ? parts.join(' &nbsp;') : '<span class="dim">geen</span>';
}
function systemPanel(sid) {
  const G = UI.G, e = G.empires[UI.me], s = G.systems[sid];
  const kn = e.known[sid] || 0;
  const ST = D.STAR_TYPES[s.star];
  let h = `<div class="phead"><span class="dot" style="color:${ST.color === '#000000' ? '#b070ff' : ST.color};background:currentColor"></span><div><h2>${esc(s.name)}</h2><div class="small dim">${ST.name}${s.relay ? ' · <span style="color:#8ff3ff">Kroonrelais</span>' : ''}${s.blight ? ' · <span style="color:#ff6fcf">Verslonden</span>' : ''}</div></div><button class="btn small close" data-act="close">✕</button></div>`;
  h += `<div class="row">${ownerTag(G, s.owner)}`;
  if (s.owner != null && s.starbase.level) {
    const sb = D.STARBASES[s.starbase.level];
    h += `<span class="tag">${sb.name}</span>`;
  }
  if (s.siege) h += `<span class="tag" style="border-color:#f55;color:#f88">Belegerd ${s.siege.t}/${s.siege.need || '?'}</span>`;
  h += `</div>`;
  if (s.owner != null && s.starbase.level && kn) {
    const sb = D.STARBASES[s.starbase.level];
    h += `<div class="small dim" style="margin-top:6px">Verdediging ${fmt(Math.max(0, s.starbase.hp))}/${sb.hp}</div><div class="bar red"><i style="width:${Math.max(0, s.starbase.hp) / sb.hp * 100}%"></i></div>`;
  }
  if (kn < 2) {
    h += `<p class="dim small">Dit stelsel is nog niet verkend. Stuur een verkenner om planeten en grondstoffen te ontdekken.</p>`;
  } else {
    h += `<h4>Grondstoffen</h4><div class="small">${depText(s.dep)}${s.owner == null ? ' <span class="dim">(buitenpost nodig)</span>' : ''}</div>`;
    h += `<h4>Planeten</h4>`;
    s.planets.forEach((p, pi) => {
      const PT = D.PLANET_TYPES[p.type];
      const hab = D.HABITABLE.includes(p.type);
      const col = p.colony ? G.colonies.find(c => c.id === p.colony) : null;
      h += `<div class="planet ${col && col.emp === UI.me ? 'mine' : ''}">${planetBall(p)}<div class="grow"><b>${esc(p.name)}</b><div class="tiny dim">${PT.name}${hab ? ` · grootte ${p.size} · max ${estMaxPop(G, UI.me, p)} bevolking${faction(e).pref === p.type ? ' · <span class="pos">voorkeur</span>' : ''}` : PT.dep ? ' · ' + depText(PT.dep) : ''}</div>`;
      if (col) h += `<div class="tiny">${ownerTag(G, col.emp)} bevolking ${fmt(col.pop)}${col.cap ? ' · hoofdstad' : ''}</div>`;
      h += `</div></div>`;
      if (col && col.emp === UI.me) h += colonyBlock(col);
    });
  }
  // quick actions with own civilian ships present
  const mine = G.fleets.filter(f => f.sys === sid && f.emp === UI.me);
  const acts = [];
  for (const f of mine) {
    if (!fleetIsCiv(f) || (f.order && f.order.paid)) continue;
    const t = f.ships[0].t;
    if (t === 'bouwschip' && s.owner == null && kn === 2) acts.push(`<button class="btn small" data-act="quick" data-kind="outpost" data-fleet="${f.id}" data-sys="${sid}" ${canOutpost(G, UI.me, sid) ? 'disabled title="' + esc(canOutpost(G, UI.me, sid)) + '"' : ''}>Bouw buitenpost (${D.RULES.outpostCostM}${D.RES_ICONS.M} ${outpostCostI(G, e)}${D.RES_ICONS.I})</button>`);
    if (t === 'bouwschip' && s.owner === UI.me && D.STARBASES[s.starbase.level + 1]) { const nx = D.STARBASES[s.starbase.level + 1]; const w = canUpgrade(G, UI.me, sid); acts.push(`<button class="btn small" data-act="quick" data-kind="upgrade" data-fleet="${f.id}" data-sys="${sid}" ${w ? 'disabled title="' + esc(w) + '"' : ''}>${nx.name} (${nx.cost}${D.RES_ICONS.M})${w ? ' <span class="tiny">– ' + esc(w) + '</span>' : ''}</button>`); }
    if (t === 'kolonie') s.planets.forEach((p, pi) => { if (D.HABITABLE.includes(p.type) && !p.colony) { const w = canColonize(G, UI.me, sid, pi); acts.push(`<button class="btn small" data-act="quick" data-kind="colonize" data-fleet="${f.id}" data-sys="${sid}" data-pi="${pi}" ${w ? 'disabled title="' + esc(w) + '"' : ''}>Koloniseer ${esc(p.name)}</button>`); } });
    if (t === 'verkenner' && kn !== 2) acts.push(`<button class="btn small" data-act="quick" data-kind="survey" data-fleet="${f.id}" data-sys="${sid}">Verken</button>`);
  }
  if (acts.length) h += `<h4>Acties</h4><div class="row">${[...new Set(acts)].join('')}</div>`;
  // fleets
  const vis = G.fleets.filter(f => f.sys === sid && (f.emp === UI.me || e.vis[sid]));
  if (vis.length) {
    h += `<h4>Vloten</h4>`;
    for (const f of vis) h += fleetRow(f);
    if (G.fleets.filter(f => f.sys === sid && f.emp === UI.me && !fleetIsCiv(f)).length > 1) h += `<button class="btn small" data-act="merge" data-sys="${sid}">Voeg vloten samen</button>`;
  }
  return h;
}
function fleetName(G, f) {
  if (f.emp === -1) return D.MONSTERS[f.monster] ? D.MONSTERS[f.monster].name : 'Monster';
  if (f.emp === -2) return f.rift ? 'Leegtescheur' : 'Leegtezwerm';
  if (fleetIsCiv(f)) return D.SHIPS[f.ships[0].t].name;
  return 'Vloot ' + (f.id % 1000);
}
function shipCounts(f) {
  const c = {};
  for (const s of f.ships) c[s.t] = (c[s.t] || 0) + 1;
  return Object.entries(c).map(([t, n]) => `${n}× ${(D.SHIPS[t] || D.MONSTER_SHIPS[t]).name}`).join(', ');
}
function fleetRow(f) {
  const G = UI.G;
  const col = fleetColor(G, f);
  const own = f.emp === UI.me;
  const pw = fleetIsCiv(f) ? '' : `<b>${fmt(fleetPower(G, f))}</b>`;
  return `<div class="fleetrow" ${own ? `data-act="selfleet" data-id="${f.id}"` : ''}><span class="dot" style="color:${col};background:${col}"></span><div class="grow"><div><b>${esc(fleetName(G, f))}</b> ${f.emp >= 0 && !own ? `<span class="tiny" style="color:${col}">${esc(G.empires[f.emp].name)}</span>` : ''}</div><div class="tiny dim">${esc(shipCounts(f))}${orderText(f) ? ' · ' + orderText(f) : ''}</div></div>${pw}</div>`;
}
function orderText(f) {
  const G = UI.G;
  if (f.emp !== UI.me) return '';
  const o = f.order;
  if (o) {
    const tn = esc(G.systems[o.target].name);
    if (o.type === 'survey') return (f.auto ? 'auto: ' : '') + 'verkent ' + tn;
    if (o.type === 'outpost') return f.path.length ? 'buitenpost bij ' + tn : `bouwt buitenpost (${f.prog}/${D.RULES.outpostTurns})`;
    if (o.type === 'upgrade') return f.path.length ? 'upgrade bij ' + tn : `upgradet sterrenbasis (${f.prog}/${D.STARBASES[G.systems[o.target].starbase.level + 1] ? D.STARBASES[G.systems[o.target].starbase.level + 1].turns : '?'})`;
    if (o.type === 'colonize') return 'koloniseert ' + esc(G.systems[o.target].planets[o.pi].name);
  }
  if (f.path.length) return '→ ' + esc(G.systems[f.path[f.path.length - 1]].name) + ` (${Math.ceil(f.path.length / (1 + (G.empires[f.emp].mods.speed || 0)))} b.)`;
  return '';
}
function colonyBlock(c) {
  const G = UI.G, e = G.empires[UI.me];
  const mx = colonyMaxPop(G, c);
  const g = c.pop < mx ? (0.16 + 0.035 * c.pop) * (1 + (e.mods.growth || 0)) * Math.max(0.15, 1 - c.pop / mx) : 0;
  const slots = colonySlots(G, c);
  const gm = garrisonMax(c);
  let h = `<div style="margin:2px 0 10px 8px;padding-left:10px;border-left:2px solid var(--line2)">`;
  h += `<div class="small">Bevolking <b>${fmt(c.pop)}</b> / ${mx} <span class="dim">(${g > 0 ? '+' + g.toFixed(2) : 'vol'} per beurt)</span>${c.unrest > 0 ? ` <span class="tag" style="color:var(--gold)">Onrust ${c.unrest}</span>` : ''}</div><div class="bar"><i style="width:${c.pop / mx * 100}%"></i></div>`;
  h += `<div class="small dim" style="margin-top:4px">Garnizoen ${fmt(Math.max(0, c.gar || 0))}/${gm}</div>`;
  h += `<h4>Gebouwen <span class="dim">${usedSlots(c)}/${slots} plaatsen</span></h4><div>`;
  for (const b of c.buildings) { const B = D.BUILDINGS[b]; h += `<span class="slot" title="${esc(bOut(B))}">${B.icon || '★'} ${esc(B.name)}</span>`; }
  h += `</div>`;
  for (let i = 0; i < c.bq.length; i++) {
    const q = c.bq[i]; const tot = buildingTurns(G, e, q.id);
    h += `<div class="q">⚒ ${esc(D.BUILDINGS[q.id].name)} <div class="bar"><i style="width:${(1 - q.left / tot) * 100}%"></i></div><span class="dim">${q.left} b.</span><button class="btn small" data-act="cancelq" data-col="${c.id}" data-kind="b" data-idx="${i}">✕</button></div>`;
  }
  if (!c.bq.length) {
    const list = Object.keys(D.BUILDINGS).filter(b => !D.BUILDINGS[b].hidden && (!D.BUILDINGS[b].req || e.techs[D.BUILDINGS[b].req]) && !(D.BUILDINGS[b].unique && c.buildings.includes(b)));
    h += `<div class="blds" style="margin-top:6px">${list.map(b => { const B = D.BUILDINGS[b]; const w = canBuild(G, c, b); return `<button class="bld" data-act="build" data-col="${c.id}" data-b="${b}" ${w ? 'disabled' : ''} title="${esc(w || B.desc || '')}"><b>${B.icon || ''} ${esc(B.name)}</b><span class="r-E">${buildingCost(G, e, b)}⚡</span> <span class="dim">${buildingTurns(G, e, b)}b</span><br><span class="tiny">${esc(bOut(B))}</span></button>`; }).join('')}</div>`;
  }
  if (c.buildings.includes('werf')) {
    h += `<h4>Scheepswerf <span class="dim">${shipyardSlots(G, e)} tegelijk</span></h4>`;
    for (let i = 0; i < c.sq.length; i++) {
      const q = c.sq[i]; const tot = shipTurns(G, e, q.id);
      h += `<div class="q">${i < shipyardSlots(G, e) ? '⚓' : '⏳'} ${esc(D.SHIPS[q.id].name)} <div class="bar blue"><i style="width:${(1 - q.left / tot) * 100}%"></i></div><span class="dim">${q.left} b.</span><button class="btn small" data-act="cancelq" data-col="${c.id}" data-kind="s" data-idx="${i}">✕</button></div>`;
    }
    const ships = Object.keys(D.SHIPS).filter(t => !D.SHIPS[t].req || e.techs[D.SHIPS[t].req]);
    h += `<div class="blds" style="margin-top:6px">${ships.map(t => { const S = D.SHIPS[t]; const w = canBuildShip(G, c, t); const st = shipStats(G, UI.me, t); return `<button class="bld" data-act="ship" data-col="${c.id}" data-t="${t}" ${w ? 'disabled' : ''} title="${esc(w || S.desc || '')}"><b>${esc(S.name)}</b><span class="r-M">${shipCost(G, e, t)}⬢</span>${S.costI ? ` <span class="r-I">${S.costI}✦</span>` : ''} <span class="dim">${shipTurns(G, e, t)}b</span><br><span class="tiny">${S.civ ? esc(S.desc) : `⚔${fmt(st.atk)} ♥${st.hp} ⛨${st.sh}`}</span></button>`; }).join('')}</div>`;
  }
  return h + `</div>`;
}
/** Suggested destinations for an idle constructor or colony ship, with one-tap orders. */
function civTargets(f, hasLocal) {
  const G = UI.G, e = G.empires[UI.me];
  const d = bfsDist(G, f.sys);
  const t = f.ships[0].t;
  let rows = [];
  if (t === 'bouwschip') {
    rows = G.systems.filter(s => s.id !== f.sys && s.owner == null && e.known[s.id] === 2 && d[s.id] < Infinity && !G.fleets.some(x => x.sys === s.id && x.emp < 0))
      .sort((a, b) => d[a.id] - d[b.id]).slice(0, 5)
      .map(s => { const w = canOutpost(G, UI.me, s.id); const habs = s.planets.filter(p => D.HABITABLE.includes(p.type) && !p.colony).length;
        return `<div class="fleetrow"><div class="grow"><b>${esc(s.name)}</b> <span class="tiny dim">${d[s.id]} sprong${d[s.id] > 1 ? 'en' : ''}</span><div class="tiny">${depText(s.dep)}${habs ? ' · ' + habs + ' bewoonbaar' : ''}${s.relay ? ' · <span style="color:#8ff3ff">Relais</span>' : ''}</div></div><button class="btn small ${w ? '' : 'primary'}" data-act="quick" data-kind="outpost" data-fleet="${f.id}" data-sys="${s.id}" ${w ? 'disabled title="' + esc(w) + '"' : ''}>Buitenpost</button></div>`; });
  } else {
    const list = [];
    for (const s of G.systems) {
      if (e.known[s.id] !== 2 || d[s.id] === Infinity) continue;
      s.planets.forEach((p, pi) => { if (D.HABITABLE.includes(p.type) && !p.colony && canColonize(G, UI.me, s.id, pi) == null) list.push({ s, p, pi, mp: estMaxPop(G, UI.me, p) }); });
    }
    rows = list.sort((a, b) => (b.mp - d[b.s.id] * 0.8) - (a.mp - d[a.s.id] * 0.8)).slice(0, 5)
      .map(x => `<div class="fleetrow">${planetBall(x.p)}<div class="grow"><b>${esc(x.p.name)}</b> <span class="tiny dim">${d[x.s.id]} sprong${d[x.s.id] === 1 ? '' : 'en'}</span><div class="tiny">${D.PLANET_TYPES[x.p.type].name} · max ${x.mp} bevolking${faction(e).pref === x.p.type ? ' · <span class="pos">voorkeur</span>' : ''}</div></div><button class="btn small primary" data-act="quick" data-kind="colonize" data-fleet="${f.id}" data-sys="${x.s.id}" data-pi="${x.pi}">Koloniseer</button></div>`);
  }
  if (rows.length) return `<h4>${t === 'bouwschip' ? 'Bouwplekken in de buurt' : 'Kolonisatiedoelen'}</h4>${rows.join('')}`;
  if (hasLocal) return '';
  return `<p class="small" style="color:var(--gold);margin-top:10px">${t === 'bouwschip'
    ? 'Nog geen bouwplek beschikbaar. Een buitenpost kan alleen in een onbezet stelsel dat al verkend is. Je verkenners zijn daar mee bezig; meestal kan het na 1–2 beurten.'
    : 'Nog geen bewoonbare planeet gevonden in verkend gebied. Wacht tot je verkenners meer stelsels hebben verkend, of claim eerst stelsels met buitenposten.'}</p>`;
}

function bOut(B) {
  const p = Object.entries(B.out).map(([k, v]) => `+${v} ${D.RES_ICONS[k]}`);
  if (B.up) p.push(`−${B.up} ⚡`);
  if (B.desc) p.push(B.desc);
  return p.join(' ');
}
function fleetPanel(f) {
  const G = UI.G, e = G.empires[UI.me];
  const own = f.emp === UI.me;
  const civ = fleetIsCiv(f);
  const col = fleetColor(G, f);
  let h = `<div class="phead"><span class="dot" style="color:${col};background:${col}"></span><div><h2>${esc(fleetName(G, f))}</h2><div class="small dim">bij <a href="#" data-act="selsys" data-id="${f.sys}" style="color:var(--mint)">${esc(G.systems[f.sys].name)}</a></div></div><button class="btn small close" data-act="close">✕</button></div>`;
  const ot = orderText(f);
  if (ot) h += `<div class="small" style="margin-bottom:8px">Status: <b>${ot}</b></div>`;
  if (!civ) {
    const byT = {};
    for (const s of f.ships) { const b = byT[s.t] = byT[s.t] || { n: 0, hp: 0, mx: 0 }; b.n++; b.hp += s.hp; b.mx += shipStats(G, f.emp, s.t).hp; }
    h += `<div class="ships">`;
    for (const t in byT) { const b = byT[t]; h += `<div>${b.n}× ${esc((D.SHIPS[t] || D.MONSTER_SHIPS[t]).name)}<div class="bar"><i style="width:${b.hp / b.mx * 100}%"></i></div></div><div class="dim small">${fmt(b.hp)}/${fmt(b.mx)}</div>`; }
    h += `</div><div class="small" style="margin-top:8px">Vlootsterkte <b>${fmt(fleetPower(G, f))}</b></div>`;
  } else {
    h += `<p class="small dim">${esc(D.SHIPS[f.ships[0].t].desc)}</p>`;
  }
  if (own) {
    h += `<hr><div class="row">`;
    if (f.ships[0].t === 'verkenner') h += `<button class="btn small ${f.auto ? 'primary' : ''}" data-act="auto" data-fleet="${f.id}" data-on="${f.auto ? 0 : 1}">${f.auto ? '✓ Automatisch verkennen' : 'Automatisch verkennen'}</button>`;
    if (f.path.length || f.order) h += `<button class="btn small" data-act="stop" data-fleet="${f.id}">Stop</button>`;
    if (!civ && f.ships.length > 1) h += `<button class="btn small" data-act="split" data-fleet="${f.id}">Splitsen</button>`;
    if (!civ && G.fleets.filter(x => x.sys === f.sys && x.emp === UI.me && !fleetIsCiv(x)).length > 1) h += `<button class="btn small" data-act="merge" data-sys="${f.sys}">Samenvoegen</button>`;
    if (f.sys !== e.capital) h += `<button class="btn small" data-act="home" data-fleet="${f.id}">Naar hoofdstad</button>`;
    h += `</div><p class="tiny dim" style="margin-top:10px">Tik op een stelsel om dit schip te sturen${civ ? ' of een opdracht te geven' : ''}. ${civ ? '' : 'Op de computer: rechtsklik.'}</p>`;
    // contextual actions where it stands
    const s = G.systems[f.sys];
    const extra = [];
    if (f.ships[0].t === 'bouwschip' && !(f.order && f.order.paid)) {
      if (s.owner == null && e.known[s.id] === 2) extra.push(`<button class="btn small primary" data-act="quick" data-kind="outpost" data-fleet="${f.id}" data-sys="${s.id}" ${canOutpost(G, UI.me, s.id) ? 'disabled' : ''}>Buitenpost hier</button>`);
      if (s.owner === UI.me && D.STARBASES[s.starbase.level + 1] && !canUpgrade(G, UI.me, s.id)) extra.push(`<button class="btn small primary" data-act="quick" data-kind="upgrade" data-fleet="${f.id}" data-sys="${s.id}">Upgrade hier</button>`);
    }
    if (f.ships[0].t === 'kolonie') s.planets.forEach((p, pi) => { if (D.HABITABLE.includes(p.type) && !p.colony && !canColonize(G, UI.me, s.id, pi)) extra.push(`<button class="btn small primary" data-act="quick" data-kind="colonize" data-fleet="${f.id}" data-sys="${s.id}" data-pi="${pi}">Koloniseer ${esc(p.name)}</button>`); });
    if (extra.length) h += `<div class="row">${extra.join('')}</div>`;
    const busy = f.order && (f.order.paid || f.order.type === 'colonize');
    if (!busy && (f.ships[0].t === 'bouwschip' || f.ships[0].t === 'kolonie')) h += civTargets(f, extra.length > 0);
  }
  return h;
}

// ---------- Modals ----------
function openModal(html, cls) {
  const m = $('#modal');
  m.innerHTML = `<div class="mbox ${cls || ''}">${html}</div>`;
  m.classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); $('#modal').innerHTML = ''; }

function showResearch() {
  const G = UI.G, e = G.empires[UI.me];
  const inc = e.income.R;
  const card = (id) => {
    const T = D.TECH_BY_ID[id];
    const cost = techCost(G, e, id);
    const turns = inc > 0 ? Math.max(1, Math.ceil((cost - (e.research.current === id ? e.research.progress : Math.min(e.research.progress, cost))) / inc)) : '∞';
    if (id === 'rep') return `<button class="card ${e.research.current === id ? 'sel' : ''}" data-act="pickTech" data-id="rep"><div class="cat" style="background:#ffd65a"></div><div class="tiny dim">Herhaalbaar</div><h3>Doorbraak ${(e.repeat || 0) + 1}</h3><p class="small">+5% energie, mineralen en onderzoek, +3% wapens en romp</p><div class="small"><span class="r-R">◈ ${cost}</span> · ~${turns} beurten</div></button>`;
    return `<button class="card ${e.research.current === id ? 'sel' : ''}" data-act="pickTech" data-id="${id}"><div class="cat" style="background:${D.CAT_COLORS[T.cat]}"></div><div class="tiny" style="color:${D.CAT_COLORS[T.cat]}">${D.CAT_NAMES[T.cat]} · niveau ${T.tier}</div><h3>${esc(T.name)}</h3><p class="small">${esc(T.txt)}</p><div class="small"><span class="r-R">◈ ${cost}</span> · ~${turns} beurten</div></button>`;
  };
  const known = D.TECHS.filter(t => e.techs[t.id]);
  const cur = e.research.current;
  openModal(`<div class="mhead"><h2>◈ Onderzoek</h2><span class="dim small">${fmt(inc)} per beurt · ${fmt(e.research.progress)} opgebouwd</span><button class="btn small close" data-act="closeModal">✕</button></div>
    ${cur ? `<p class="small">Bezig met <b>${esc(D.TECH_BY_ID[cur] ? D.TECH_BY_ID[cur].name : 'Doorbraak')}</b>. Je kunt wisselen zonder voortgang te verliezen.</p>` : '<p class="small" style="color:var(--gold)">Kies een technologie. Onderzoekspunten worden ondertussen gespaard.</p>'}
    <div class="cards">${e.research.options.map(card).join('')}</div>
    <h4 style="margin-top:16px">Onderzocht (${known.length}/${D.TECHS.length}${e.repeat ? ' + ' + e.repeat + ' doorbraken' : ''})</h4>
    <div class="small">${known.length ? known.map(t => `<span class="slot" style="border-left:3px solid ${D.CAT_COLORS[t.cat]}" title="${esc(t.txt)}">${esc(t.name)}</span>`).join('') : '<span class="dim">Nog niets</span>'}</div>
    <h4 style="margin-top:12px">Nog te ontdekken</h4>
    <div class="small dim">${D.TECHS.filter(t => !e.techs[t.id]).map(t => `<span class="slot" style="opacity:${(t.req || []).every(r => e.techs[r]) ? 0.9 : 0.45}" title="${esc(t.txt)}${t.req ? ' · vereist ' + t.req.map(r => D.TECH_BY_ID[r].name).join(', ') : ''}">${esc(t.name)}</span>`).join('')}</div>`);
}

function attitude(op) { return op <= -40 ? ['Vijandig', '#ff6b6b'] : op < -10 ? ['Wantrouwig', '#ffb36b'] : op < 20 ? ['Neutraal', '#c9d3ee'] : op < 50 ? ['Vriendelijk', '#8cffc8'] : ['Hartelijk', '#5fffb0']; }
function showDiplomacy() {
  const G = UI.G, me = G.empires[UI.me];
  const myP = empirePower(G, UI.me);
  let h = `<div class="mhead"><h2>⚑ Diplomatie</h2><button class="btn small close" data-act="closeModal">✕</button></div>`;
  for (const o of G.empires) {
    if (o.id === UI.me) continue;
    const r = me.rel[o.id];
    if (!r.contact) { h += `<div class="emp"><div class="emblem" style="background:#333;color:#888">?</div><div><h3>Onbekend rijk</h3><p class="small dim">Je hebt nog geen contact. Verken verder om hen te vinden.</p></div></div>`; continue; }
    if (!o.alive) { h += `<div class="emp" style="opacity:.5"><div class="emblem" style="background:${o.color}">${esc(o.name[0])}</div><div><h3>${esc(o.name)}</h3><p class="small dim">Vernietigd.</p></div></div>`; continue; }
    const op = opinion(G, o.id, UI.me);
    const [att, ac] = attitude(op);
    const theirP = empirePower(G, o.id);
    const ratio = theirP / Math.max(1, myP);
    const strength = ratio > 1.5 ? 'Veel sterker' : ratio > 1.1 ? 'Sterker' : ratio > 0.9 ? 'Gelijkwaardig' : ratio > 0.6 ? 'Zwakker' : 'Veel zwakker';
    const wc = canDeclareWar(G, UI.me, o.id);
    h += `<div class="emp"><div class="emblem" style="background:${o.color}">${esc(o.name[0])}</div><div>
      <div class="row"><h3 class="grow">${esc(o.name)}</h3>${r.war ? '<span class="tag" style="color:#ff8080;border-color:#ff6b6b">OORLOG</span>' : r.pact ? '<span class="tag" style="color:var(--mint);border-color:var(--mint)">Verdrag</span>' : '<span class="tag">Vrede</span>'}</div>
      <div class="small dim">${o.name !== faction(o).name ? esc(faction(o).name) + ' · ' : ''}${systemsOf(G, o.id).length} stelsels · leger: ${strength}</div>
      <div class="small" style="margin:4px 0">Houding: <b style="color:${ac}">${att}</b> (${op > 0 ? '+' : ''}${op})</div>
      <div class="bar" style="margin-bottom:8px"><i style="width:${(op + 100) / 2}%;background:${ac}"></i></div>
      <div class="row">
        ${r.war ? `<button class="btn small" data-act="peace" data-emp="${o.id}">Vrede voorstellen</button>` : `<button class="btn small danger" data-act="war" data-emp="${o.id}" ${wc ? 'disabled title="' + esc(wc) + '"' : ''}>Oorlog${me.mods.freeWar ? '' : ' (' + D.RULES.warCostI + '✦)'}</button>`}
        ${!r.war && !r.pact ? `<button class="btn small" data-act="pact" data-emp="${o.id}" title="Vereist opinie ≥ 20">Verdrag (${D.RULES.pactCostI}✦)</button>` : ''}
        ${r.pact ? `<button class="btn small" data-act="unpact" data-emp="${o.id}">Verdrag opzeggen</button>` : ''}
        <button class="btn small" data-act="gift" data-emp="${o.id}">Geschenk (${D.RULES.giftE}⚡)</button>
      </div>${wc && !r.war ? `<div class="tiny dim" style="margin-top:4px">${esc(wc)}</div>` : ''}</div></div>`;
  }
  openModal(h);
}

function showEmpire(tab) {
  const G = UI.G, e = G.empires[UI.me];
  UI.tab = tab || UI.tab || 'overzicht';
  const T = UI.tab;
  const tabs = [['overzicht', 'Overzicht'], ['kolonies', 'Kolonies'], ['edicten', 'Edicten'], ['markt', 'Markt'], ['kroon', 'De Kroon'], ['scores', 'Ranglijst']];
  let h = `<div class="mhead"><div class="emblem" style="background:${e.color}">${esc(e.name[0])}</div><div><h2>${esc(e.name)}</h2><div class="small dim">${esc(faction(e).name)}</div></div><button class="btn small close" data-act="closeModal">✕</button></div>
    <div class="tabs">${tabs.map(([k, n]) => `<button class="btn small ${T === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${n}</button>`).join('')}</div>`;
  if (T === 'overzicht') {
    const cols = coloniesOf(G, UI.me);
    const pop = cols.reduce((a, c) => a + c.pop, 0);
    h += `<table class="st"><tr><th>Grondstof</th><th>Voorraad</th><th>Per beurt</th></tr>
      ${D.RES_KEYS.map(k => `<tr><td>${RI(k)} ${D.RES_NAMES[k]}</td><td>${fmt(k === 'R' ? e.research.progress : e.res[k])}</td><td class="${e.income[k] < 0 ? 'neg' : 'pos'}">${sgn(e.income[k])}</td></tr>`).join('')}</table>
      <p class="small dim">Energie-onderhoud van gebouwen, schepen en bases: ${fmt(e.income.upkeep)} per beurt. Bij een negatieve energievoorraad dalen mineralen en onderzoek met 30%.</p>
      <table class="st"><tr><td>Stelsels</td><td>${systemsOf(G, UI.me).length}</td><td>Kolonies</td><td>${cols.length}</td></tr><tr><td>Bevolking</td><td>${fmt(pop)}</td><td>Vlootsterkte</td><td>${fmt(empirePower(G, UI.me))}</td></tr>
      <tr><td>Schepen verloren</td><td>${e.stats.lost}</td><td>Vernietigd</td><td>${e.stats.killed}</td></tr><tr><td>Kroonrelais</td><td>${relaysHeld(G, UI.me)}/${G.relays.length}</td><td>Score</td><td>${fmt(scoreOf(G, e))}</td></tr></table>
      <h4 style="margin-top:12px">Eigenschappen</h4><div class="small">${faction(e).traits.map(t => `<span class="slot">${esc(t)}</span>`).join('')}</div>
      ${Object.keys(e.edicts).length ? `<h4>Actieve edicten</h4><div class="small">${Object.entries(e.edicts).map(([id, t]) => `<span class="slot">${esc(D.EDICTS[id].name)} (${t})</span>`).join('')}</div>` : ''}`;
  } else if (T === 'kolonies') {
    const cols = coloniesOf(G, UI.me).sort((a, b) => b.pop - a.pop);
    h += `<table class="st"><tr><th>Kolonie</th><th>Bevolking</th><th>Gebouwen</th><th>Bouwt</th></tr>${cols.map(c => { const p = G.systems[c.sys].planets[c.pi]; return `<tr data-act="selsys" data-id="${c.sys}" style="cursor:pointer"><td>${c.cap ? '♛ ' : ''}${esc(p.name)}</td><td>${fmt(c.pop)}/${colonyMaxPop(G, c)}</td><td>${usedSlots(c)}/${colonySlots(G, c)}</td><td class="small">${c.bq.length ? esc(D.BUILDINGS[c.bq[0].id].name) : '<span style="color:var(--gold)">niets</span>'}${c.sq.length ? ' · ' + c.sq.length + ' schip' : ''}</td></tr>`; }).join('')}</table>`;
  } else if (T === 'edicten') {
    h += `<p class="small dim">Edicten kosten invloed (${fmt(e.res.I)}✦ beschikbaar) en werken een aantal beurten.</p><div class="cards">${Object.entries(D.EDICTS).map(([id, E]) => { const w = canEdict(G, UI.me, id); return `<button class="card ${e.edicts[id] ? 'sel' : ''}" data-act="edict" data-id="${id}" ${w ? 'disabled' : ''}><h3>${esc(E.name)}</h3><p class="small">${esc(E.txt)}</p><div class="small"><span class="r-I">${E.cost}✦</span> · ${E.turns} beurten${e.edicts[id] ? ' · <b class="pos">nog ' + e.edicts[id] + '</b>' : ''}</div></button>`; }).join('')}</div>`;
  } else if (T === 'markt') {
    const rate = e.mods.trade ? D.RULES.marketRateTyr : D.RULES.marketRate;
    h += `<p class="small">Koers: ${rate} : 1${e.mods.trade ? ' <span class="pos">(Kartelkoers)</span>' : ''}. Je hebt ${fmt(e.res.E)}⚡ en ${fmt(e.res.M)}⬢.</p>
      <div class="row"><b style="width:150px">Energie → mineralen</b>${[100, 300, 1000].map(a => `<button class="btn small" data-act="trade" data-from="E" data-amt="${a}" ${e.res.E < a ? 'disabled' : ''}>${a}⚡ → ${Math.floor(a / rate)}⬢</button>`).join('')}</div>
      <div class="row" style="margin-top:8px"><b style="width:150px">Mineralen → energie</b>${[100, 300, 1000].map(a => `<button class="btn small" data-act="trade" data-from="M" data-amt="${a}" ${e.res.M < a ? 'disabled' : ''}>${a}⬢ → ${Math.floor(a / rate)}⚡</button>`).join('')}</div>`;
  } else if (T === 'kroon') {
    const w = canStartKroon(G, UI.me);
    h += `<p class="small">De Kroon is een oud netwerk van relais. Wie er minstens <b>${relaysNeeded(G)}</b> van de ${G.relays.length} bezit en <b>De Kroonsleutel</b> heeft onderzocht, kan haar wekken (${D.RULES.kroonCostI}✦ en ${D.RULES.kroonCostE}⚡). Daarna moet je de relais ${D.RULES.kroonTurns - (e.faction === 'synode' ? 5 : 0)} beurten vasthouden terwijl de hele nevel je aanvalt.</p>
      <table class="st"><tr><th>Relais</th><th>Eigenaar</th><th>Bewaking</th></tr>${G.relays.map(r => { const s = G.systems[r]; const kn = e.known[r]; const guard = G.fleets.some(f => f.sys === r && f.emp === -1); return `<tr ${kn ? `data-act="selsys" data-id="${r}" style="cursor:pointer"` : ''}><td>${kn ? esc(s.name) : '<span class="dim">Onbekend</span>'}</td><td>${kn ? (s.owner != null ? `<span style="color:${G.empires[s.owner].color}">${esc(G.empires[s.owner].name)}</span>` : 'Niemand') : '?'}</td><td>${kn ? (guard ? '<span class="neg">Oude Wachter</span>' : '—') : '?'}</td></tr>`; }).join('')}</table>
      <div class="row" style="margin-top:12px"><span class="grow small dim">${w ? esc(w) : 'Alles is klaar.'}</span><button class="btn gold" data-act="kroon" ${w ? 'disabled' : ''}>✧ Wek de Kroon</button></div>`;
  } else if (T === 'scores') {
    const rows = G.empires.map(o => ({ o, sc: scoreOf(G, o) })).sort((a, b) => b.sc - a.sc);
    h += `<canvas id="scoreChart" width="700" height="220" style="width:100%;height:auto;background:rgba(0,0,0,0.25);border-radius:10px"></canvas>
      <table class="st" style="margin-top:8px"><tr><th>Rijk</th><th>Score</th><th>Stelsels</th></tr>${rows.map(({ o, sc }) => `<tr><td><span class="dot" style="color:${o.color};background:${o.color}"></span>${o.id === UI.me || me_contact(o) ? esc(o.name) : 'Onbekend rijk'}</td><td>${fmt(sc)}</td><td>${systemsOf(G, o.id).length}</td></tr>`).join('')}</table>`;
  }
  openModal(h);
  if (T === 'scores') drawScoreChart($('#scoreChart'));
}
function me_contact(o) { return UI.G.empires[UI.me].rel[o.id].contact; }
function drawScoreChart(cv) {
  if (!cv) return;
  const G = UI.G, g = cv.getContext('2d');
  const W = cv.width, H = cv.height, pad = 28;
  let mx = 10, n = 1;
  for (const e of G.empires) { n = Math.max(n, e.score.length); for (const v of e.score) mx = Math.max(mx, v); }
  g.clearRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,0.1)'; g.fillStyle = '#94a0c4'; g.font = '11px system-ui';
  for (let i = 0; i <= 4; i++) { const y = H - pad - (H - pad * 2) * i / 4; g.beginPath(); g.moveTo(pad, y); g.lineTo(W - 8, y); g.stroke(); g.fillText(Math.round(mx * i / 4), 2, y + 4); }
  for (const e of G.empires) {
    if (e.id !== UI.me && !me_contact(e) && !G.over) continue;
    g.strokeStyle = e.color; g.lineWidth = e.id === UI.me ? 3 : 1.8; g.beginPath();
    e.score.forEach((v, i) => { const x = pad + (W - pad - 8) * i / Math.max(1, n - 1), y = H - pad - (H - pad * 2) * v / mx; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke();
  }
  g.fillStyle = '#94a0c4'; g.fillText('beurt ' + n, W - 60, H - 8);
}

function showLog() {
  const G = UI.G;
  const lines = G.log.filter(l => l.emp === UI.me || l.emp === -1).slice(-150).reverse();
  openModal(`<div class="mhead"><h2>☰ Logboek</h2><button class="btn small close" data-act="closeModal">✕</button></div>
    ${lines.map(l => `<div class="logline" ${l.sys != null && G.empires[UI.me].known[l.sys] ? `data-act="selsys" data-id="${l.sys}"` : ''}><span class="t">B${l.turn}</span>${esc(l.text)}</div>`).join('') || '<p class="dim">Nog niets gebeurd.</p>'}`);
}
function showMenu() {
  openModal(`<div class="mhead"><h2>Menu</h2><button class="btn small close" data-act="closeModal">✕</button></div>
    <div class="col">
      <button class="btn" data-act="closeModal">Verder spelen</button>
      <button class="btn" data-act="save">Opslaan</button>
      <button class="btn" data-act="settings">Instellingen</button>
      <button class="btn" data-act="help">Hoe speel je?</button>
      <button class="btn" data-act="export">Exporteer / importeer</button>
      <button class="btn danger" data-act="quit">Opslaan en naar hoofdmenu</button>
    </div>`, 'narrow');
}
function showSettings() {
  openModal(`<div class="mhead"><h2>Instellingen</h2><button class="btn small close" data-act="closeModal">✕</button></div>
    <div class="col">
      <label>Muziek <input type="range" id="volM" min="0" max="1" step="0.05" value="${UI.settings.music}"></label>
      <label>Geluidseffecten <input type="range" id="volS" min="0" max="1" step="0.05" value="${UI.settings.sfx}"></label>
      <button class="btn small ${UI.settings.autosave ? 'primary' : ''}" data-act="toggleAutosave">${UI.settings.autosave ? '✓ ' : ''}Automatisch opslaan na elke beurt</button>
      <p class="tiny dim">Sneltoetsen: Enter/spatie = volgende beurt, R = onderzoek, D = diplomatie, E = rijk, L = logboek, H = hoofdstad, Esc = sluiten.</p>
    </div>`, 'narrow');
  const bind = (id, kind) => $(id).addEventListener('input', (ev) => { UI.settings[kind] = +ev.target.value; AudioFX.setVolume(kind, +ev.target.value); store(SET_KEY, JSON.stringify(UI.settings)); if (kind === 'sfx') AudioFX.sfx('click'); });
  bind('#volM', 'music'); bind('#volS', 'sfx');
}
function showExport() {
  const data = UI.G ? (() => { const a = UI.G.anim; UI.G.anim = null; const s = JSON.stringify(UI.G); UI.G.anim = a; return s; })() : '';
  openModal(`<div class="mhead"><h2>Exporteer / importeer</h2><button class="btn small close" data-act="closeModal">✕</button></div>
    <p class="small dim">Kopieer deze tekst om je spel te bewaren, of plak een eerder geëxporteerd spel en kies Importeer.</p>
    <textarea id="expTxt">${esc(data)}</textarea>
    <div class="row" style="margin-top:8px"><span class="grow"></span><button class="btn" data-act="copyExport">Kopieer</button><button class="btn" data-act="import">Importeer</button></div>`);
}
function doImport() {
  const txt = $('#expTxt').value.trim();
  if (!txt) return toast('Niets om te importeren', 'err');
  try { UI.G = restore(txt); } catch (e) { return toast('Ongeldige speldata', 'err'); }
  closeModal(); enterGame(); saveGame();
}
function showHelp() {
  openModal(`<div class="mhead"><h2>Hoe speel je Nevelkroon?</h2><button class="btn small close" data-act="closeModal">✕</button></div>
    <div class="small" style="line-height:1.6">
    <h4>Doel</h4><p>Win door <b>de Kroon te wekken</b> (bezit genoeg Kroonrelais en onderzoek De Kroonsleutel), door <b>60% van alle stelsels</b> ${D.RULES.dominationTurns} beurten vast te houden, door <b>alle rivalen te vernietigen</b>, of met de <b>hoogste score</b> na beurt ${D.RULES.turnLimit}.</p>
    <h4>Besturing</h4><p>Sleep om te bewegen, knijp of scroll om te zoomen. Tik op een stelsel voor informatie. Tik op een eigen schip, en daarna op een stelsel, om het te sturen. Burgerschepen tonen dan direct hun mogelijke opdrachten.</p>
    <h4>Grondstoffen</h4><p>${RI('E')} <b>Energie</b> betaalt gebouwen en onderhoud. ${RI('M')} <b>Mineralen</b> bouwen schepen en bases. ${RI('R')} <b>Onderzoek</b> levert technologie. ${RI('I')} <b>Invloed</b> is nodig voor buitenposten, kolonieschepen, edicten en diplomatie.</p>
    <h4>Uitbreiden</h4><p>Verkenners onthullen planeten en anomalieën. Bouwschepen claimen verkende stelsels met een buitenpost: je krijgt dan de grondstoffen van dat stelsel. Kolonieschepen stichten kolonies op bewoonbare planeten. Planeten van je voorkeurstype zijn extra groot.</p>
    <h4>Kolonies</h4><p>Bevolking groeit vanzelf en levert grondstoffen. Meer bevolking geeft meer bouwplaatsen. Een scheepswerf bouwt meerdere schepen tegelijk.</p>
    <h4>Oorlog</h4><p>Vloten vechten automatisch als vijanden elkaar ontmoeten. Vernietig sterrenbases en garnizoenen en blijf in het stelsel om het te belegeren. Na enkele beurten is het van jou. Planetaire schilden verlengen een belegering. Veroverde kolonies hebben een tijdje last van onrust.</p>
    <h4>Gevaren</h4><p>Monsters bewaken waardevolle stelsels en laten buit achter. Oude Wachters beschermen de Kroonrelais. Rond beurt ${D.RULES.crisisTurn} opent <b>de Leegte</b> scheuren waaruit steeds sterkere vloten komen. Sluit de scheuren om de nevel te redden.</p>
    <h4>Diplomatie</h4><p>De houding van andere rijken hangt af van hun karakter, gedeelde grenzen, geschenken en eerdere oorlogen. Na een vrede volgt een wapenstilstand van 20 beurten. Wie te machtig wordt, krijgt een coalitie tegen zich.</p>
    </div>`);
}

// ---------- Events ----------
function eventArt(seedStr, hue) {
  let h = 0; for (const ch of seedStr) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const c1 = `hsl(${(h % 360)},70%,55%)`, c2 = `hsl(${(h * 7) % 360},60%,30%)`;
  const px = 30 + h % 40, py = 40 + (h >> 4) % 30;
  return `<svg viewBox="0 0 400 120" width="100%" height="120" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="eg${h}" cx="${px}%" cy="${py}%" r="60%"><stop offset="0" stop-color="${c1}" stop-opacity=".55"/><stop offset="1" stop-color="#02030a" stop-opacity="1"/></radialGradient><radialGradient id="ep${h}" cx="35%" cy="35%"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient></defs>
    <rect width="400" height="120" fill="url(#eg${h})"/>${Array.from({ length: 40 }, (_, i) => `<circle cx="${(h * (i + 3) * 13) % 400}" cy="${(h * (i + 7) * 7) % 120}" r="${((h >> i) & 1) + 0.4}" fill="#fff" opacity=".7"/>`).join('')}
    <circle cx="${px * 4}" cy="${py * 1.2 + 20}" r="34" fill="url(#ep${h})"/><ellipse cx="${px * 4}" cy="${py * 1.2 + 20}" rx="58" ry="11" fill="none" stroke="${c1}" stroke-opacity=".6" stroke-width="2"/></svg>`;
}
function showPending() {
  const G = UI.G;
  const idx = G.pending.findIndex(p => p.emp === UI.me);
  if (idx < 0) return;
  const ev = G.pending[idx];
  AudioFX.sfx('event');
  if (ev.kind === 'anomaly') {
    const A = D.ANOMALIES.find(a => a.id === ev.id);
    openModal(`<div class="evimg">${eventArt(A.id)}</div><div class="mhead"><h2>${esc(A.title)}</h2></div><p class="small dim">Anomalie bij ${esc(G.systems[ev.sys].name)}</p><p>${esc(A.text)}</p>
      <div class="col">${A.choices.map((c, i) => `<button class="btn ${i === 0 ? 'primary' : ''}" data-act="choice" data-idx="${idx}" data-ch="${i}">${esc(c.t)}</button>`).join('')}</div>`, 'narrow');
    focusSys(ev.sys);
  } else {
    const o = G.empires[ev.from];
    const peace = ev.kind === 'peaceOffer';
    openModal(`<div class="mhead"><div class="emblem" style="background:${o.color}">${esc(o.name[0])}</div><h2>${esc(o.name)}</h2></div>
      <p>${peace ? 'Onze vloten bloeden. Laten we deze zinloze oorlog beëindigen. Wij stellen vrede voor.' : 'Wij zien in u een betrouwbare buur. Wij stellen een niet-aanvalsverdrag voor.'}</p>
      <div class="row"><span class="grow"></span><button class="btn" data-act="choice" data-idx="${idx}" data-ch="1">Weigeren</button><button class="btn primary" data-act="choice" data-idx="${idx}" data-ch="0">Accepteren</button></div>`, 'narrow');
  }
}

// ---------- Turn ----------
function endTurn() {
  const G = UI.G;
  if (!G || UI.busy || G.over) return;
  if (G.pending.some(p => p.emp === UI.me)) { showPending(); return; }
  UI.busy = true;
  closeModal();
  AudioFX.sfx('turn');
  const prevLog = G.log.length;
  let anim;
  try { anim = processTurn(G); } catch (err) { UI.busy = false; if (err instanceof GameError) { toast(err.message, 'err'); return; } throw err; }
  rStartAnim(G, anim);
  refresh();
  $('#endturn').disabled = true;
  R.onAnimDone = () => afterTurn(prevLog);
  if (!R.anim) afterTurn(prevLog);
}
function afterTurn(prevLog) {
  const G = UI.G;
  UI.busy = false;
  const fresh = G.log.slice(prevLog).filter(l => l.emp === UI.me || l.emp === -1);
  const types = new Set(fresh.map(l => l.type));
  let shown = 0;
  const maxT = window.innerWidth <= 760 ? 3 : 6;
  const prio = (l) => ({ big: 0, crisis: 0, war: 1, combat: 1, peace: 2, colony: 2, tech: 3, event: 3, loot: 3, contact: 3 }[l.type] ?? 5);
  for (const l of fresh.slice().sort((a, b) => prio(a) - prio(b))) { if (shown++ < maxT) toast(l.text, l.type, l.sys); }
  const intruders = G.fleets.filter(f => f.emp !== UI.me && f.emp !== -1 && G.systems[f.sys].owner === UI.me && hostile(G, f.emp, UI.me) && fleetArmed(G, f));
  if (intruders.length) {
    const s0 = G.systems[intruders[0].sys];
    toast('⚠ Vijandelijke vloot in ' + s0.name + (intruders.length > 1 ? ' en ' + (intruders.length - 1) + ' andere stelsel(s)' : '') + '!', 'war', s0.id);
    AudioFX.sfx('alert');
  }
  if (types.has('crisis')) AudioFX.sfx('crisis');
  else if (types.has('war')) AudioFX.sfx('war');
  else if (types.has('tech')) AudioFX.sfx('research');
  else if (types.has('colony')) AudioFX.sfx('colony');
  else if (types.has('peace')) AudioFX.sfx('peace');
  for (const l of fresh) if (l.type === 'colony' || (l.type === 'build' && /Buitenpost/.test(l.text))) { if (l.sys != null) { const s = G.systems[l.sys]; rPulse(s.x, s.y, G.empires[UI.me].color); } }
  const e = G.empires[UI.me];
  const war = G.empires.some(o => o.alive && o.id !== UI.me && e.rel[o.id].war);
  AudioFX.setIntensity((war ? 0.6 : 0) + (G.crisis && !G.crisis.over && G.crisis.rifts > 0 ? 0.4 : 0) + (G.kroon || G.dom ? 0.3 : 0));
  if (UI.settings.autosave && !G.over) saveGame();
  refresh();
  if (G.over) { setTimeout(showEnd, 600); return; }
  if (G.pending.some(p => p.emp === UI.me)) setTimeout(showPending, 350);
}
function showEnd() {
  const G = UI.G;
  const win = G.over.winner === UI.me;
  const w = G.over.winner != null ? G.empires[G.over.winner] : null;
  const reasons = { kroon: 'door het wekken van de Nevelkroon', dominantie: 'door overheersing van de nevel', verovering: 'door alle rivalen te veroveren', score: 'met de hoogste score', dood: '' };
  AudioFX.sfx(win ? 'victory' : 'defeat');
  store(SAVE_KEY, '');
  openModal(`<div style="text-align:center"><h1 class="logo" style="font-size:44px">${win ? 'OVERWINNING' : 'NEDERLAAG'}</h1>
    <p>${G.over.reason === 'dood' ? 'Je rijk is van de sterrenkaart geveegd.' : `${esc(w.name)} wint ${reasons[G.over.reason]}.`}</p>
    <p class="small dim">Beurt ${G.turn - 1} · Jouw score ${fmt(scoreOf(G, G.empires[UI.me]))}</p></div>
    <canvas id="scoreChart" width="700" height="220" style="width:100%;height:auto;background:rgba(0,0,0,0.25);border-radius:10px"></canvas>
    <div class="row" style="margin-top:12px"><span class="grow"></span><button class="btn" data-act="closeModal">Bekijk de kaart</button><button class="btn primary" data-act="newFromEnd">Nieuw spel</button></div>`);
  drawScoreChart($('#scoreChart'));
}

// ---------- Toasts ----------
function toast(text, type, sys) {
  const t = document.createElement('div');
  t.className = 'toast ' + (type || '');
  t.textContent = text;
  if (sys != null && UI.G) t.addEventListener('click', () => { selectSystem(sys); focusSys(sys); });
  $('#toasts').appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .5s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 500); }, type === 'err' ? 2600 : 5200);
  while ($('#toasts').children.length > 7) $('#toasts').firstChild.remove();
}

window.addEventListener('load', boot);
