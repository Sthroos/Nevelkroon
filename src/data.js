// ===================== NEVELKROON — statische speldata =====================
'use strict';

const RES_KEYS = ['E', 'M', 'R', 'I'];
const RES_NAMES = { E: 'Energie', M: 'Mineralen', R: 'Onderzoek', I: 'Invloed' };
const RES_ICONS = { E: '⚡', M: '⬢', R: '◈', I: '✦' };

// Faction definitions. Modifiers are additive multipliers (0.15 = +15%).
const FACTIONS = [
  {
    id: 'aurel', name: 'Aurelisch Verbond', short: 'Verbond', color: '#f2c14e', ship: 'arrow',
    pref: 'oceaan', aggression: 0.35, opinionGiven: 15,
    mods: { R: 0.15, I: 0.25, opinion: 15 },
    desc: 'Een democratisch verbond van kolonies die de oude Kroonarchieven bestuderen. Sterk in onderzoek en diplomatie.',
    traits: ['+15% onderzoek', '+25% invloed', 'Andere rijken mogen je (+15 opinie)'],
  },
  {
    id: 'zwerm', name: "Kh'arak Zwerm", short: 'Zwerm', color: '#e8553d', ship: 'claw',
    pref: 'woestijn', aggression: 0.75, opinionGiven: -20,
    mods: { M: 0.25, growth: 0.45, hull: 0.1, opinion: -20 },
    desc: 'Een insectoïde bijenkorf die elke wereld als broedplaats ziet. Groeit razendsnel en vreet planeten leeg.',
    traits: ['+25% mineralen', '+45% bevolkingsgroei', '+10% romp (chitinepantser)', 'Gewantrouwd (−20 opinie)'],
  },
  {
    id: 'synode', name: 'Lumen Synode', short: 'Synode', color: '#b07cff', ship: 'crystal',
    pref: 'ijs', aggression: 0.45, opinionGiven: 0,
    mods: { shield: 0.25, anomaly: 0.3, I: 0.15, R: 0.1 },
    desc: 'Kristallijne wezens met een gedeeld bewustzijn. Zij horen de Kroon zingen en willen haar wekken.',
    traits: ['+25% schilden', '+10% onderzoek', 'Betere anomalie-uitkomsten', '+15% invloed', 'Kroon-ontwaking 5 beurten korter'],
  },
  {
    id: 'tyr', name: 'Vrije Kartels van Tyr', short: 'Kartels', color: '#3fd0c9', ship: 'disc',
    pref: 'toendra', aggression: 0.4, opinionGiven: 5,
    mods: { E: 0.25, buildCost: -0.15, trade: 1 },
    desc: 'Een netwerk van handelshuizen. Alles heeft een prijs, ook vrede. Handelen tegen voordelige koersen.',
    traits: ['+25% energie', 'Gebouwen 15% goedkoper', 'Voordelige marktkoers'],
  },
  {
    id: 'ijzer', name: 'IJzeren Hegemonie', short: 'Hegemonie', color: '#6aa6ff', ship: 'blade',
    pref: 'aards', aggression: 0.9, opinionGiven: -10,
    mods: { weapon: 0.15, shipCost: -0.1, freeWar: 1, opinion: -10 },
    desc: 'Een gemilitariseerde cyborgstaat. Zij geloven dat alleen de sterkste de Kroon verdient.',
    traits: ['+15% wapenschade', 'Schepen 10% goedkoper', 'Oorlog verklaren kost geen invloed'],
  },
];

const PLANET_TYPES = {
  aards:    { name: 'Aards',       hab: 1.0, color: '#4f9d5d', color2: '#2f6fa8' },
  oceaan:   { name: 'Oceaan',      hab: 0.85, color: '#2a74c9', color2: '#1d4f8f' },
  woestijn: { name: 'Woestijn',    hab: 0.75, color: '#d39b4a', color2: '#a86e2d' },
  toendra:  { name: 'Toendra',     hab: 0.75, color: '#8a9e7a', color2: '#5e6f55' },
  ijs:      { name: 'IJs',         hab: 0.65, color: '#cfe8f5', color2: '#8fb7d0' },
  gaia:     { name: 'Gaia',        hab: 1.25, color: '#5fd17a', color2: '#2f9fbf' },
  kaal:     { name: 'Kaal',        hab: 0, color: '#8b8580', color2: '#5a5550', dep: { M: 1 } },
  gas:      { name: 'Gasreus',     hab: 0, color: '#c9a37a', color2: '#9a6f50', dep: { E: 1 } },
  asteroid: { name: 'Asteroïden',  hab: 0, color: '#7a7068', color2: '#4a4440', dep: { M: 2 } },
  lava:     { name: 'Lava',        hab: 0, color: '#d2502d', color2: '#6a1f12', dep: { M: 1 } },
};
const HABITABLE = ['aards', 'oceaan', 'woestijn', 'toendra', 'ijs', 'gaia'];

const STAR_TYPES = {
  geel:    { name: 'Gele ster',      color: '#ffe08a', r: 9,  weight: 30 },
  oranje:  { name: 'Oranje ster',    color: '#ffb36b', r: 8,  weight: 22 },
  rood:    { name: 'Rode dwerg',     color: '#ff7a5c', r: 6,  weight: 22 },
  wit:     { name: 'Witte ster',     color: '#eef4ff', r: 9,  weight: 10 },
  blauw:   { name: 'Blauwe reus',    color: '#8cc4ff', r: 12, weight: 8, dep: { E: 1 } },
  neutron: { name: 'Neutronenster',  color: '#c6e6ff', r: 5,  weight: 4, dep: { R: 2 } },
  gat:     { name: 'Zwart gat',      color: '#000000', r: 10, weight: 4, dep: { E: 2, R: 1 } },
};

// Buildings. out = production, up = energy upkeep. req = tech id.
const BUILDINGS = {
  kern:      { name: 'Hoofdstad-kern', out: { E: 6, M: 6, R: 4, I: 2 }, up: 0, cost: 0, turns: 0, noSlot: true, hidden: true },
  mijn:      { name: 'Mijnbouwcomplex', out: { M: 4 }, up: 0.5, cost: 70, turns: 3, icon: '⬢' },
  centrale:  { name: 'Fusiecentrale', out: { E: 4.5 }, up: 0, cost: 70, turns: 3, icon: '⚡' },
  lab:       { name: 'Onderzoekslab', out: { R: 4 }, up: 1, cost: 90, turns: 3, icon: '◈' },
  werf:      { name: 'Scheepswerf', out: {}, up: 1, cost: 110, turns: 4, icon: '⚓', unique: true, desc: 'Maakt scheepsbouw mogelijk.' },
  habitat:   { name: 'Habitatkoepel', out: {}, up: 1, cost: 100, turns: 3, icon: '⌂', req: 'so_habitat', pop: 3, unique: true, desc: '+3 max. bevolking' },
  admin:     { name: 'Bestuurscentrum', out: { I: 1.5 }, up: 2, cost: 140, turns: 4, icon: '✦', req: 'so_admin', unique: true },
  fabriek:   { name: 'Nano-fabriek', out: { M: 8 }, up: 2, cost: 200, turns: 5, icon: '⬢', req: 'en_mining2' },
  reactor:   { name: 'Singulariteitsreactor', out: { E: 9 }, up: 0, cost: 200, turns: 5, icon: '⚡', req: 'ph_power2' },
  archief:   { name: 'Kroonarchief', out: { R: 9 }, up: 3, cost: 220, turns: 5, icon: '◈', req: 'ph_ai' },
  schild:    { name: 'Planetair schild', out: {}, up: 2, cost: 160, turns: 4, icon: '⛨', req: 'so_defense', unique: true, desc: 'Verdedigt de planeet en verlengt belegeringen met 3 beurten.' },
};

// Ships. cost in minerals (M) unless noted.
const SHIPS = {
  verkenner: { name: 'Verkenner', civ: true, cost: 50, turns: 2, up: 0.5, hp: 20, atk: 0, sh: 0, ev: 0.5, desc: 'Snel (2 sprongen per beurt) en het enige schip dat anomalieën kan onderzoeken.' },
  bouwschip: { name: 'Bouwschip', civ: true, cost: 70, turns: 2, up: 0.5, hp: 25, atk: 0, sh: 0, ev: 0.2, desc: 'Bouwt buitenposten en sterrenbases.' },
  kolonie:   { name: 'Kolonieschip', civ: true, cost: 150, costI: 3, turns: 4, up: 1, hp: 30, atk: 0, sh: 0, ev: 0, desc: 'Sticht een nieuwe kolonie op een bewoonbare planeet.' },
  korvet:    { name: 'Korvet', cost: 40, turns: 2, up: 0.4, hp: 25, atk: 5, sh: 0, ev: 0.3, size: 1 },
  fregat:    { name: 'Fregat', cost: 90, turns: 3, up: 0.8, hp: 45, atk: 11, sh: 15, ev: 0.12, size: 2, req: 'en_frigate' },
  kruiser:   { name: 'Kruiser', cost: 190, turns: 4, up: 1.6, hp: 110, atk: 22, sh: 40, ev: 0.05, size: 3, req: 'en_cruiser' },
  slagschip: { name: 'Slagschip', cost: 420, turns: 6, up: 3.5, hp: 260, atk: 52, sh: 90, ev: 0, size: 4, req: 'en_battleship' },
  titaan:    { name: 'Titaan', cost: 1100, turns: 10, up: 9, hp: 700, atk: 130, sh: 250, ev: 0, size: 6, req: 'en_titan', unique: true, desc: 'Vlaggenschip: +15% schade voor de hele vloot.' },
};
const WARSHIPS = ['korvet', 'fregat', 'kruiser', 'slagschip', 'titaan'];

const STARBASES = [
  null,
  { name: 'Buitenpost', atk: 3, hp: 80, up: 0 },
  { name: 'Sterrenbasis', atk: 18, hp: 380, up: 1.5, cost: 200, turns: 4, req: 'en_starbase' },
  { name: 'Citadel', atk: 55, hp: 1150, up: 4, cost: 500, turns: 6, req: 'en_citadel' },
];

// Monsters / neutrals: ships with atk/hp/sh
const MONSTERS = {
  kristal:  { name: 'Kristalzwerm', ships: [['kristalsplinter', 5]], loot: { M: 120, R: 40 } },
  wachter:  { name: 'Oude Wachter', ships: [['wachter', 1]], loot: { R: 300, E: 200 } },
  draak:    { name: 'Nevelleviathan', ships: [['leviathan', 1]], loot: { M: 600, E: 600, R: 400 } },
  piraten:  { name: 'Piratenbende', ships: [['piraat', 4]], loot: { E: 150, M: 100 } },
  ontwaakt: { name: 'Ontwaakt oorlogsschip', ships: [['oudschip', 1]], loot: { R: 120 } },
};
const MONSTER_SHIPS = {
  kristalsplinter: { name: 'Kristalsplinter', hp: 45, atk: 7, sh: 0, ev: 0.2 },
  wachter:         { name: 'Oude Wachter', hp: 1700, atk: 120, sh: 300, ev: 0 },
  leviathan:       { name: 'Nevelleviathan', hp: 4200, atk: 260, sh: 500, ev: 0 },
  piraat:          { name: 'Piratenkaper', hp: 50, atk: 8, sh: 10, ev: 0.15 },
  oudschip:        { name: 'Oud oorlogsschip', hp: 200, atk: 25, sh: 40, ev: 0 },
  jager:           { name: 'Leegtejager', hp: 70, atk: 15, sh: 10, ev: 0.15 },
  verslinder:      { name: 'Verslinder', hp: 320, atk: 60, sh: 60, ev: 0 },
  scheur:          { name: 'Leegtescheur', hp: 5200, atk: 80, sh: 500, ev: 0, structure: true },
};

// Technology. cat: ph (natuurkunde), en (techniek), so (maatschappij)
// eff: modifier increments; unlock: text
const TECHS = [
  // ---- Tier 1
  { id: 'ph_lasers', cat: 'ph', tier: 1, name: 'Gefocuste lasers', eff: { weapon: 0.15 }, txt: '+15% wapenschade' },
  { id: 'ph_shields', cat: 'ph', tier: 1, name: 'Deflectorschilden', eff: { shield: 0.25 }, txt: '+25% schilden' },
  { id: 'ph_power', cat: 'ph', tier: 1, name: 'Koude fusie', eff: { E: 0.15 }, txt: '+15% energie' },
  { id: 'ph_labs', cat: 'ph', tier: 1, name: 'Kwantumcomputers', eff: { R: 0.15 }, txt: '+15% onderzoek' },
  { id: 'ph_sensors', cat: 'ph', tier: 1, name: 'Dieptesensoren', eff: { vision: 1, anomaly: 0.1 }, txt: '+1 zichtbereik, betere anomalieën' },
  { id: 'en_mining', cat: 'en', tier: 1, name: 'Diepe mijnbouw', eff: { M: 0.15 }, txt: '+15% mineralen' },
  { id: 'en_frigate', cat: 'en', tier: 1, name: 'Fregatrompen', eff: {}, txt: 'Ontgrendelt Fregat' },
  { id: 'en_starbase', cat: 'en', tier: 1, name: 'Sterrenbasisbouw', eff: {}, txt: 'Buitenposten upgraden tot Sterrenbasis' },
  { id: 'en_armor', cat: 'en', tier: 1, name: 'Composietpantser', eff: { hull: 0.2 }, txt: '+20% romp' },
  { id: 'so_growth', cat: 'so', tier: 1, name: 'Genetische optimalisatie', eff: { growth: 0.3 }, txt: '+30% bevolkingsgroei' },
  { id: 'so_habitat', cat: 'so', tier: 1, name: 'Habitatkoepels', eff: {}, txt: 'Ontgrendelt Habitatkoepel (+3 bevolking)' },
  { id: 'so_admin', cat: 'so', tier: 1, name: 'Planetaire administratie', eff: { I: 0.1, slots: 1 }, txt: '+1 bouwplaats, Bestuurscentrum' },
  { id: 'so_xeno', cat: 'so', tier: 1, name: 'Xenologie', eff: { anomaly: 0.25 }, txt: 'Betere anomalie-uitkomsten' },
  // ---- Tier 2
  { id: 'ph_plasma', cat: 'ph', tier: 2, name: 'Plasmawapens', req: ['ph_lasers'], eff: { weapon: 0.25 }, txt: '+25% wapenschade' },
  { id: 'ph_shields2', cat: 'ph', tier: 2, name: 'Fasevelden', req: ['ph_shields'], eff: { shield: 0.4 }, txt: '+40% schilden' },
  { id: 'ph_power2', cat: 'ph', tier: 2, name: 'Nulpuntenergie', req: ['ph_power'], eff: { E: 0.2 }, txt: '+20% energie, Singulariteitsreactor' },
  { id: 'ph_ai', cat: 'ph', tier: 2, name: 'Synthetische intelligentie', req: ['ph_labs'], eff: { R: 0.2 }, txt: '+20% onderzoek, Kroonarchief' },
  { id: 'en_cruiser', cat: 'en', tier: 2, name: 'Kruiserrompen', req: ['en_frigate'], eff: {}, txt: 'Ontgrendelt Kruiser' },
  { id: 'en_mining2', cat: 'en', tier: 2, name: 'Asteroïderaffinage', req: ['en_mining'], eff: { M: 0.2 }, txt: '+20% mineralen, Nano-fabriek' },
  { id: 'en_drive', cat: 'en', tier: 2, name: 'Hyperdrive II', req: ['ph_sensors'], eff: { speed: 1 }, txt: 'Schepen springen 2 stelsels per beurt' },
  { id: 'en_armor2', cat: 'en', tier: 2, name: 'Neutroniumpantser', req: ['en_armor'], eff: { hull: 0.35 }, txt: '+35% romp' },
  { id: 'en_automation', cat: 'en', tier: 2, name: 'Robotassemblage', req: ['en_mining'], eff: { buildTime: 1, shipCost: -0.1 }, txt: 'Bouwtijd −1, schepen 10% goedkoper' },
  { id: 'so_terra', cat: 'so', tier: 2, name: 'Terravorming', req: ['so_growth'], eff: { maxPop: 0.15 }, txt: '+15% max. bevolking' },
  { id: 'so_diplo', cat: 'so', tier: 2, name: 'Interstellaire diplomatie', req: ['so_admin'], eff: { opinion: 20, I: 0.1 }, txt: '+20 opinie, +10% invloed' },
  { id: 'so_defense', cat: 'so', tier: 2, name: 'Planetaire verdediging', req: ['en_armor'], eff: {}, txt: 'Ontgrendelt Planetair schild' },
  { id: 'so_unity', cat: 'so', tier: 2, name: 'Gedeelde idealen', req: ['so_admin'], eff: { I: 0.3 }, txt: '+30% invloed' },
  // ---- Tier 3
  { id: 'ph_lance', cat: 'ph', tier: 3, name: 'Tachyonlansen', req: ['ph_plasma'], eff: { weapon: 0.35 }, txt: '+35% wapenschade' },
  { id: 'ph_shields3', cat: 'ph', tier: 3, name: 'Hyperschilden', req: ['ph_shields2'], eff: { shield: 0.5 }, txt: '+50% schilden' },
  { id: 'ph_relay', cat: 'ph', tier: 3, name: 'Kroonresonantie', req: ['ph_ai', 'ph_sensors'], eff: { R: 0.1 }, txt: 'Onthult alle Kroonrelais, +10% onderzoek' },
  { id: 'en_battleship', cat: 'en', tier: 3, name: 'Slagschiprompen', req: ['en_cruiser'], eff: {}, txt: 'Ontgrendelt Slagschip' },
  { id: 'en_citadel', cat: 'en', tier: 3, name: 'Citadellen', req: ['en_starbase', 'en_armor2'], eff: {}, txt: 'Sterrenbasis upgraden tot Citadel' },
  { id: 'so_arcology', cat: 'so', tier: 3, name: 'Arcologieën', req: ['so_terra'], eff: { maxPop: 0.25, slots: 1 }, txt: '+25% max. bevolking, +1 bouwplaats' },
  { id: 'so_harmony', cat: 'so', tier: 3, name: 'Galactische harmonie', req: ['so_unity', 'so_diplo'], eff: { E: 0.1, M: 0.1, R: 0.1 }, txt: '+10% energie, mineralen en onderzoek' },
  // ---- Tier 4
  { id: 'en_titan', cat: 'en', tier: 4, name: 'Titanen', req: ['en_battleship', 'ph_lance'], eff: {}, txt: 'Ontgrendelt Titaan' },
  { id: 'en_armor3', cat: 'en', tier: 4, name: 'Kroonlegering', req: ['en_armor2', 'ph_relay'], eff: { hull: 0.5 }, txt: '+50% romp' },
  { id: 'ph_kroon', cat: 'ph', tier: 4, name: 'De Kroonsleutel', req: ['ph_relay'], eff: {}, txt: 'Maakt het ontwaken van de Kroon mogelijk' },
];
const TECH_COST = { 1: 110, 2: 300, 3: 650, 4: 1150, 5: 900 };
const TECH_BY_ID = Object.fromEntries(TECHS.map(t => [t.id, t]));
const CAT_NAMES = { ph: 'Natuurkunde', en: 'Techniek', so: 'Maatschappij' };
const CAT_COLORS = { ph: '#5ab8ff', en: '#ffb04a', so: '#7be38a' };

// Anomaly events. Each choice has an `fx` key resolved in logic.js
const ANOMALIES = [
  { id: 'wrak', title: 'Verlaten wrak', text: 'De verkenner vindt een eeuwenoud wrak, half bedekt met ijs. Het schip draagt geen bekend embleem.',
    choices: [{ t: 'Berg de onderdelen', fx: { M: 90 } }, { t: 'Bestudeer de systemen', fx: { R: 70 } }] },
  { id: 'resonantie', title: 'Kristallijne resonantie', text: 'Een maan trilt op een frequentie die de sensoren laat gloeien. Er zit enorm veel energie in opgesloten.',
    choices: [{ t: 'Oogst de energie (risico)', fx: { E: 160, risk: 0.25 } }, { t: 'Meet alleen de frequentie', fx: { R: 35 } }] },
  { id: 'sonde', title: 'Oude sonde', text: 'Een kleine sonde van de Kroon zweeft nog steeds rond. Zijn geheugen is beschadigd maar leesbaar.',
    choices: [{ t: 'Ontcijfer het geheugen', fx: { research: 0.5 } }, { t: 'Verkoop de data', fx: { E: 80, I: 5 } }] },
  { id: 'slaper', title: 'Slapend oorlogsschip', text: 'Een gigantisch schip drijft zonder energie door het stelsel. Zijn reactor lijkt nog intact.',
    choices: [{ t: 'Wek het schip (riskant)', fx: { wake: 1 } }, { t: 'Haal de databanken leeg', fx: { R: 45 } }] },
  { id: 'gaia', title: 'Gaia-echo', text: 'Biologische signalen wijzen op een oud terravormingsproject. Een van de planeten hier kan een paradijs worden.',
    choices: [{ t: 'Activeer de terravormers', fx: { gaia: 1 } }] },
  { id: 'gordel', title: 'Rijke asteroïdengordel', text: 'De gordel in dit stelsel blijkt vol zeldzame metalen te zitten.',
    choices: [{ t: 'Registreer de vondst', fx: { depM: 3 } }] },
  { id: 'tijd', title: 'Tijdsverstoring', text: 'De klokken aan boord lopen terug. Het team keert terug met metingen van… morgen?',
    choices: [{ t: 'Analyseer de metingen', fx: { R: 100 } }, { t: 'Vergeet het snel', fx: { I: 8 } }] },
  { id: 'echo', title: 'Echo van de Kroon', text: 'Een fluisterend signaal toont een kaart: vijf lichtpunten verspreid door de nevel. De Kroonrelais!',
    choices: [{ t: 'Leg de coördinaten vast', fx: { reveal: 1, R: 30 } }] },
  { id: 'vluchtelingen', title: 'Vluchtelingen', text: 'Een konvooi vluchtelingen van een vernietigde wereld vraagt om onderdak.',
    choices: [{ t: 'Bied ze een thuis (−40 energie)', fx: { E: -40, pop: 2, I: 5 } }, { t: 'Stuur ze weg', fx: {} }] },
  { id: 'piraten', title: 'Piratenbasis', text: 'In een asteroïde zit een verborgen piratenbasis. Ze zijn nog niet vijandig — nog niet.',
    choices: [{ t: 'Koop ze af (−60 energie)', fx: { E: -60, I: 3 } }, { t: 'Negeer ze', fx: { pirates: 1, R: 20 } }] },
  { id: 'nevel', title: 'Zingende nevel', text: 'Het gas in dit stelsel trilt als een koor. De bemanning voelt zich geïnspireerd.',
    choices: [{ t: 'Neem de klanken op', fx: { I: 18 } }, { t: 'Bestudeer de gasdynamica', fx: { R: 55 } }] },
  { id: 'materie', title: 'Donkere materie', text: 'Een concentratie donkere materie buigt het licht. Een perfecte plek voor onderzoek.',
    choices: [{ t: 'Plaats meetstations', fx: { depR: 2 } }] },
  { id: 'artefact', title: 'Fluisterend artefact', text: 'Een zwart artefact spreekt in de dromen van de bemanning. Het belooft kennis — tegen een prijs.',
    choices: [{ t: 'Gebruik het artefact', fx: { modR: 0.1, opinionAll: -10 } }, { t: 'Vernietig het', fx: { E: 50, I: 5 } }] },
  { id: 'bibliotheek', title: 'Voorloperbibliotheek', text: 'Een complete bibliotheek van de Kroonbouwers! De kennis is overweldigend.',
    choices: [{ t: 'Download alles', fx: { research: 1 } }] },
  { id: 'kwallen', title: 'Ruimtekwallen', text: 'Een kudde gigantische ruimtekwallen trekt door het stelsel.',
    choices: [{ t: 'Volg en bestudeer ze', fx: { R: 50 } }, { t: 'Oogst hun gloei-organen', fx: { E: 100, I: -3 } }] },
  { id: 'erts', title: 'Levend erts', text: 'Mineralen die langzaam groeien. Als je ze laat rusten, worden ze meer.',
    choices: [{ t: 'Delf nu', fx: { M: 120 } }, { t: 'Laat groeien', fx: { depM: 2 } }] },
];

const EMPIRE_EVENTS = [
  { title: 'Wetenschappelijke doorbraak', text: 'Je onderzoekers boeken een onverwacht succes.', fx: { R: 60 } },
  { title: 'Mijnstoring', text: 'Een aardbeving legt een belangrijke mijn stil.', fx: { M: -40 } },
  { title: 'Volksfeest', text: 'Een feest van honderd dagen versterkt het saamhorigheidsgevoel.', fx: { I: 10 } },
  { title: 'Zonnevlam', text: 'Een zonnevlam beschadigt het energienet.', fx: { E: -50 } },
  { title: 'Rijke vondst', text: 'Prospectors vinden een ader puur iridium.', fx: { M: 80 } },
  { title: 'Handelsdelegatie', text: 'Vrije handelaren betalen voor doorgang.', fx: { E: 70 } },
  { title: 'Babyboom', text: 'De bevolking groeit sneller dan verwacht.', fx: { pop: 1 } },
];

const NAME_A = ['Vel', 'Ar', 'Dun', 'Kor', 'Ise', 'Mar', 'Tal', 'Oro', 'Zen', 'Hal', 'Bri', 'Cy', 'Eos', 'Fen', 'Gal', 'Ith', 'Jor', 'Kae', 'Lys', 'Nym', 'Or', 'Pyr', 'Quo', 'Ryn', 'Sel', 'Tor', 'Ul', 'Vas', 'Wyn', 'Xal', 'Yr', 'Zor', 'Ae', 'Ben', 'Dra', 'Esk', 'Hel', 'Kal', 'Mor', 'Nev', 'Sol', 'Thar'];
const NAME_B = ['dan', 'ia', 'or', 'ex', 'ion', 'ara', 'en', 'is', 'us', 'eth', 'ion', 'ova', 'ir', 'oth', 'ane', 'el', 'ith', 'um', 'ax', 'yra', 'ost', 'ene', 'ar', 'ix', 'ros', 'ea', 'ul', 'iel', 'ak', 'on'];
const NAME_C = ['', '', '', '', ' Prime', ' Majoris', ' Minor', ' Nova', '', ' Ultima', '', ''];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

// Edicts: temporary empire-wide boosts bought with influence
const EDICTS = {
  mijnbouw:   { name: 'Mijnbouwoffensief', cost: 50, turns: 12, eff: { M: 0.25 }, txt: '+25% mineralen' },
  energie:    { name: 'Netwerkoptimalisatie', cost: 50, turns: 12, eff: { E: 0.25 }, txt: '+25% energie' },
  onderzoek:  { name: 'Onderzoeksprioriteit', cost: 60, turns: 12, eff: { R: 0.25 }, txt: '+25% onderzoek' },
  oorlog:     { name: 'Oorlogseconomie', cost: 60, turns: 12, eff: { shipCost: -0.2, weapon: 0.1 }, txt: 'Schepen 20% goedkoper, +10% wapens' },
  groei:      { name: 'Bevolkingsprogramma', cost: 40, turns: 12, eff: { growth: 0.5 }, txt: '+50% bevolkingsgroei' },
};

const DIFFICULTY = {
  makkelijk: { name: 'Makkelijk', ai: 0.8, crisis: 0.7 },
  normaal: { name: 'Normaal', ai: 1.0, crisis: 1.0 },
  zwaar: { name: 'Zwaar', ai: 1.3, crisis: 1.3 },
};
const GALAXY_SIZES = {
  klein: { name: 'Klein', n: 32, w: 1700, h: 1200 },
  middel: { name: 'Middel', n: 50, w: 2200, h: 1550 },
  groot: { name: 'Groot', n: 75, w: 2800, h: 1950 },
};

const RULES = {
  outpostCostM: 60, outpostBaseI: 3, outpostPerSystems: 5, outpostTurns: 2,
  warCostI: 25, pactCostI: 10, giftE: 100,
  siegeTurns: 3, shieldSiegeBonus: 3,
  crisisTurn: 125, crisisWaveEvery: 7,
  kroonCostI: 120, kroonCostE: 400, kroonTurns: 15, kroonRelaysNeeded: 3,
  dominationShare: 0.6, dominationTurns: 12, turnLimit: 250,
  marketRate: 3, marketRateTyr: 1.6,
  combatRounds: 5,
};

const DATA = { RES_KEYS, RES_NAMES, RES_ICONS, FACTIONS, PLANET_TYPES, HABITABLE, STAR_TYPES, BUILDINGS, SHIPS, WARSHIPS, STARBASES, MONSTERS, MONSTER_SHIPS, TECHS, TECH_COST, TECH_BY_ID, CAT_NAMES, CAT_COLORS, ANOMALIES, EMPIRE_EVENTS, EDICTS, NAME_A, NAME_B, NAME_C, ROMAN, DIFFICULTY, GALAXY_SIZES, RULES };
