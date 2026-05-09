"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const partyEl = document.getElementById("party");
const metaEl = document.getElementById("meta");
const msgEl = document.getElementById("message");
const commandsEl = document.getElementById("commands");
const touchEl = document.getElementById("touchControls");
const overlayEl = document.getElementById("overlay");
const modalEl = document.getElementById("modal");

let _ac = null;
const sfx = {
  _t(f, dur, type = 'square', vol = 0.18, delay = 0) {
    try {
      if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
      const o = _ac.createOscillator(), g = _ac.createGain();
      o.connect(g); g.connect(_ac.destination);
      o.type = type; o.frequency.value = f;
      const t = _ac.currentTime + delay;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.start(t); o.stop(t + dur + 0.01);
    } catch(e) {}
  },
  step()     { this._t(110, 0.06, 'square', 0.10); },
  bump()     { this._t(65, 0.12, 'sawtooth', 0.22); },
  turn()     { this._t(440, 0.03, 'square', 0.07); },
  attack()   { this._t(330, 0.05, 'square', 0.22); this._t(220, 0.09, 'square', 0.16, 0.05); },
  miss()     { this._t(350, 0.05, 'square', 0.06); },
  hit()      { this._t(180, 0.13, 'sawtooth', 0.28); },
  victory()  { [523, 659, 784, 1047].forEach((f, i) => this._t(f, 0.18, 'square', 0.22, i * 0.11)); },
  spell()    { for (let i = 0; i < 5; i++) this._t(440 + i * 110, 0.08, 'sine', 0.18, i * 0.06); },
  stairs()   { [392, 330, 262].forEach((f, i) => this._t(f, 0.13, 'square', 0.18, i * 0.09)); },
  chest()    { [523, 659, 784].forEach((f, i) => this._t(f, 0.12, 'square', 0.20, i * 0.09)); },
  boss()     { [220, 196, 175, 165].forEach((f, i) => this._t(f, 0.20, 'sawtooth', 0.34, i * 0.11)); },
  levelup()  { [392, 494, 588, 784].forEach((f, i) => this._t(f, 0.14, 'square', 0.20, i * 0.10)); },
  curse()    { this._t(110, 0.28, 'sawtooth', 0.22); this._t(90, 0.22, 'sawtooth', 0.18, 0.15); },
  encounter(){ this._t(262, 0.08, 'square', 0.16); this._t(330, 0.08, 'square', 0.16, 0.10); this._t(196, 0.22, 'square', 0.22, 0.20); },
};
let _bgmTimer = null;
const bgm = {
  notes: [196, 0, 220, 196, 0, 165, 0, 0, 196, 0, 247, 220, 0, 196, 0, 0],
  idx: 0,
  start() {
    this.stop(); this.idx = 0;
    const tick = () => {
      const f = bgm.notes[bgm.idx++ % bgm.notes.length];
      if (f) sfx._t(f, 0.11, 'square', 0.07);
      _bgmTimer = setTimeout(tick, 190);
    };
    tick();
  },
  stop() { if (_bgmTimer) { clearTimeout(_bgmTimer); _bgmTimer = null; } }
};

const SAVE_KEY = "sakambit_wizardry_v3";
const DIRS = [
  { name: "北", dx: 0, dy: -1 },
  { name: "東", dx: 1, dy: 0 },
  { name: "南", dx: 0, dy: 1 },
  { name: "西", dx: -1, dy: 0 }
];

const CLASSES = {
  lord:    { label: "君主",   hp: 44, mp: [2, 0, 0], atk: 8,  ac: 6, int: 14, pie: 12, agi: 8,  spell: "mage",   ranged: true },
  fighter: { label: "戦士",   hp: 58, mp: [0, 0, 0], atk: 13, ac: 4, int: 2,  pie: 4,  agi: 6 },
  mage:    { label: "魔術師", hp: 31, mp: [3, 1, 0], atk: 4,  ac: 9, int: 18, pie: 7,  agi: 9,  spell: "mage" },
  priest:  { label: "僧侶",   hp: 40, mp: [2, 1, 0], atk: 7,  ac: 7, int: 8,  pie: 17, agi: 7,  spell: "priest" },
  thief:   { label: "盗賊",   hp: 36, mp: [0, 0, 0], atk: 7,  ac: 8, int: 10, pie: 5,  agi: 16 },
  samurai: { label: "侍",     hp: 46, mp: [1, 0, 0], atk: 11, ac: 5, int: 13, pie: 7,  agi: 11, spell: "mage",   ranged: true },
  ninja:   { label: "忍者",   hp: 42, mp: [0, 0, 0], atk: 12, ac: 5, int: 11, pie: 5,  agi: 20, ranged: true },
  bishop:  { label: "司教",   hp: 33, mp: [2, 1, 0], atk: 5,  ac: 8, int: 15, pie: 15, agi: 7,  spell: "bishop" },
};

const partyTemplate = [
  { id: "sakambit", name: "サカムビット", cls: "lord", align: "悪" },
  { id: "galf", name: "ガルフ", cls: "fighter", align: "中" },
  { id: "mina", name: "ミナ", cls: "mage", align: "中" },
  { id: "freia", name: "フレイア", cls: "priest", align: "善" },
  { id: "velk", name: "ベルク", cls: "thief", align: "中" },
  { id: "shadou", name: "シャドウ", cls: "samurai", align: "悪" }
];

const EQUIPMENT = {
  shortSword:   { name: "短剣",           type: "weapon",    atk: 2,  ac: 0,  price: 80 },
  longSword:    { name: "長剣",           type: "weapon",    atk: 5,  ac: 0,  price: 240 },
  muramasaShard:{ name: "村正の欠片",     type: "weapon",    atk: 9,  ac: -1, price: 780 },
  cursedBlade:  { name: "呪われた刃",     type: "weapon",    atk: 13, ac: 0,  price: 0, cursed: true },
  robe:         { name: "古いローブ",     type: "armor",     atk: 0,  ac: -1, price: 70 },
  chain:        { name: "鎖帷子",         type: "armor",     atk: 0,  ac: -3, price: 210 },
  plate:        { name: "領主の鎧",       type: "armor",     atk: 0,  ac: -5, price: 620 },
  hexArmor:     { name: "呪縛の鎧",       type: "armor",     atk: 0,  ac: -7, price: 0, cursed: true },
  ring:         { name: "守りの指輪",     type: "accessory", atk: 0,  ac: -2, price: 420 },
  shuriken:     { name: "手裏剣セット",   type: "weapon",    atk: 7,  ac: 0,  price: 320 },
};

const ITEMS = {
  potion: { name: "ディオス薬", price: 60 },
  ether: { name: "魔力の香", price: 140 },
  antidote: { name: "毒消し", price: 40 },
  stoneCure: { name: "石化解き", price: 300 },
  malorScroll: { name: "帰還の巻物", price: 450 }
};

const SPELLS = {
  mage: [
    { id: "halito", name: "ハリト", lv: 1, kind: "damage", power: 18, target: "one", text: "小炎" },
    { id: "katino", name: "カティノ", lv: 1, kind: "sleep", power: 0, target: "group", text: "眠り" },
    { id: "dilto", name: "ディルト", lv: 2, kind: "weaken", power: 2, target: "group", text: "幻惑" },
    { id: "mahalito", name: "マハリト", lv: 2, kind: "damage", power: 28, target: "group", text: "大炎" },
    { id: "tiltowait", name: "ティルト", lv: 3, kind: "damage", power: 48, target: "all", text: "爆炎" }
  ],
  priest: [
    { id: "dios", name: "ディオス", lv: 1, kind: "heal", power: 28, target: "ally", text: "治癒" },
    { id: "badios", name: "バディオス", lv: 1, kind: "damage", power: 16, target: "one", text: "聖撃" },
    { id: "montino", name: "モンティノ", lv: 2, kind: "silence", power: 0, target: "group", text: "封呪" },
    { id: "dialko", name: "ディアルコ", lv: 2, kind: "cure", power: 0, target: "ally", text: "解毒" },
    { id: "madi", name: "マディ", lv: 3, kind: "fullheal", power: 999, target: "ally", text: "完全治癒" }
  ]
};

const FLOORS = [
  {
    name: "B1F 廃兵の回廊", color: "#58ff9a", start: [1, 17, 0], encounter: 0.08,
    map: [
      "###################",
      "#..T....#.....E..>#",
      "#.#####.#.#####.#.#",
      "#.....#.#.#...#.#.#",
      "#####.#.#.#.#.#.#.#",
      "#...#.#...#.#...#.#",
      "#.#.#.#####.#####.#",
      "#.#...#...#.....#.#",
      "#.#####.#.#####.#.#",
      "#.....#.#.....#.#.#",
      "###.#.#.#####.#.#.#",
      "#...#.#.....#...#.#",
      "#.###.#####.#####.#",
      "#.#.....#...#.....#",
      "#.#.###.#.###.###.#",
      "#...#...#.....#.K.#",
      "#.###.###########.#",
      "#S................#",
      "###################"
    ],
    events: {
      "3,1": { type: "chest", table: "b1", once: true },
      "15,1": { type: "message", text: "壁に『玄室に入る時は、帰り道を数えよ』と刻まれている。" },
      "17,1": { type: "stairs", to: 1, need: "b1Key", locked: "扉は古い紋章鍵で閉じられている。" },
      "16,15": { type: "flag", flag: "b1Key", text: "古い紋章鍵を拾った。" },
      "9,5": { type: "rotate", text: "床が回転した！方向感覚が狂う。" },
      "5,9": { type: "rotate", text: "魔法の渦が方向を歪めた。" }
    },
    monsters: ["skeleton","kobold","rat","brigand","goblin","zombie","cave_bat","slime","cave_spider","imp","bandit","mushroom_man","toad","mud_bat","bone_dog","plague_rat","thug","hollow","rust_sprite","cave_worm"]
  },
  {
    name: "B2F 魔導工房跡", color: "#60c8ff", start: [1, 1, 1], encounter: 0.105,
    map: [
      "###################",
      "#<....#......T....#",
      "#####.#.#########.#",
      "#.....#.....#.....#",
      "#.#########.#.###.#",
      "#.#...E...#.#.#...#",
      "#.#.#####.#.#.#.###",
      "#.#.#...#...#.#...#",
      "#.#.#.#.#####.###.#",
      "#...#.#.....#.....#",
      "#####.#####.#####.#",
      "#...#.....#.....#.#",
      "#.#.#####.#####.#.#",
      "#.#.....#.....#.#.#",
      "#.#####.#####.#.#.#",
      "#.....#.....#.#...#",
      "#.###.#####.#.###>#",
      "#...........#.....#",
      "###################"
    ],
    events: {
      "1,1": { type: "stairs", to: 0 },
      "13,1": { type: "chest", table: "b2", once: true },
      "7,5": { type: "trap", damage: 8, text: "魔法陣が閃き、全員が焦げた。" },
      "17,16": { type: "stairs", to: 2 },
      "9,9": { type: "dark", duration: 10, text: "呪いの霧が視界を奪う。明かりが消えた！" },
      "3,13": { type: "rotate", text: "廊下が歪む。方位が反転した。" },
      "15,13": { type: "spelltrap", text: "魔封じの間に踏み込んだ。しばらく呪文が使えない。", duration: 6 }
    },
    monsters: ["gargoyle","wisp","moth","golem","fire_elemental","ice_sprite","stone_snake","bronze_scarab","crystal_fly","hex_eye","venom_moth","amber_golem","sand_wraith","cave_leech","rock_crab","mold_creep","dust_devil","toxic_ooze","brass_knight","jar_ghost","swarm_bee","chaos_sprite","magma_slug","gloom_bat"]
  },
  {
    name: "B3F 地下牢獄", color: "#bf8cff", start: [1, 1, 1], encounter: 0.12,
    map: [
      "###################",
      "#<......#.........#",
      "#.#####.#.#######.#",
      "#.#...#.#...#.....#",
      "#.#.#.#.###.#.#####",
      "#...#.#.....#.....#",
      "#####.###########.#",
      "#.....#.....T...#.#",
      "#.#####.#######.#.#",
      "#.#.....#.....#.#.#",
      "#.#.#####.###.#.#.#",
      "#.#.#.....#...#...#",
      "#.#.#.#####.#####.#",
      "#...#.....#.....#.#",
      "#.#######.#####.#.#",
      "#.......#.....#.#.#",
      "#######.#####.#.#>#",
      "#.............#...#",
      "###################"
    ],
    events: {
      "1,1": { type: "stairs", to: 1 },
      "11,7": { type: "chest", table: "b3", once: true },
      "17,16": { type: "stairs", to: 3 },
      "5,5": { type: "dark", duration: 14, text: "地下牢の闇が深い。松明が一瞬で消えた。" },
      "13,11": { type: "rotate", text: "重力が歪む。上下左右がわからなくなった。" },
      "9,3": { type: "trapdoor", damage: 12, text: "落とし穴！床が崩れ、全員が落下した。" },
      "7,1": { type: "ally", id: "ralmhas", once: true }
    },
    monsters: ["minotaur","warden","shade","hound","dark_knight","bone_mage","chain_ghost","stone_troll","cave_bear","wolf_shade","plague_doc","prison_guard","iron_claw","mist_hag","eye_beast","shadow_dog","dungeon_rat","rot_walker","blood_moth","tomb_bat","ruin_warden","hex_hand","mud_troll","cave_horror"]
  },
  {
    name: "B4F 宝物庫回廊", color: "#ffcf66", start: [1, 1, 1], encounter: 0.135,
    map: [
      "###################",
      "#<....T#..........#",
      "#.#####.#########.#",
      "#.#.....#.......#.#",
      "#.#.#####.#####.#.#",
      "#.#.....#.#...#.#.#",
      "#.#####.#.#.#.#.#.#",
      "#.....#.#...#.#...#",
      "#####.#.#####.#####",
      "#.....#.....#.....#",
      "#.#########.#####.#",
      "#.#.......#.....#.#",
      "#.#.#####.#####.#.#",
      "#.#.#...#.....#...#",
      "#.#.#.#.#####.###.#",
      "#...#.#.....#...K.#",
      "#.###.#####.#####>#",
      "#.................#",
      "###################"
    ],
    events: {
      "1,1": { type: "stairs", to: 2 },
      "6,1": { type: "chest", table: "b4", once: true },
      "16,15": { type: "flag", flag: "royalSeal", text: "王印を取り戻した。玉座への封印が解ける。" },
      "17,16": { type: "stairs", to: 4, need: "royalSeal", locked: "王印がなければ玉座へは進めない。" }
    },
    monsters: ["dragon","banshee","lich","mimic","vampire","wyvern","basilisk","medusa","bone_lord","death_knight","necromancer","gold_golem","chaos_knight","shadow_dragon","void_eye","plague_knight","flame_lich","iron_golem","rune_guardian","elder_mimic","void_slime","cursed_armor","death_moth","sin_eater","arch_wisp"]
  },
  {
    name: "B5F 玉座の間", color: "#ff6666", start: [1, 1, 1], encounter: 0.10,
    map: [
      "###################",
      "#<................#",
      "#.###############.#",
      "#.................#",
      "#.###############.#",
      "#.................#",
      "#.###############.#",
      "#.................#",
      "#.###############.#",
      "#........B........#",
      "#.###############.#",
      "#.................#",
      "#.###############.#",
      "#.................#",
      "#.###############.#",
      "#.................#",
      "#.###############.#",
      "#.................#",
      "###################"
    ],
    events: {
      "1,1": { type: "stairs", to: 3 },
      "9,9": { type: "boss" }
    },
    monsters: ["angel","mirror","guardian","oracle","fallen_angel","demon_lord","void_dragon","holy_knight","dark_oracle","soul_reaper","divine_beast","chaos_lord","archdemon","storm_angel","death_angel","void_knight","holy_golem","curse_mage","doom_guardian","pale_rider","star_warden","abyss_eye","eternal_knight","sin_dragon","ruin_lord","dark_lord"]
  }
];

const MONSTERS = {
  // B1F - Tier 1
  skeleton:     { name: "スケルトン",   hp: 18, ac: 8,  atk: 7,  dice: 4,  exp: 12,  gold: 14,  skill: "none",   group: [2,5] },
  kobold:       { name: "コボルド",     hp: 14, ac: 9,  atk: 6,  dice: 3,  exp: 9,   gold: 10,  skill: "none",   group: [2,6] },
  rat:          { name: "大ネズミ",     hp: 12, ac: 10, atk: 5,  dice: 3,  exp: 8,   gold: 8,   skill: "poison", group: [3,7] },
  brigand:      { name: "盗賊崩れ",     hp: 20, ac: 7,  atk: 8,  dice: 5,  exp: 18,  gold: 25,  skill: "ambush", group: [1,4] },
  goblin:       { name: "ゴブリン",     hp: 10, ac: 10, atk: 5,  dice: 3,  exp: 7,   gold: 9,   skill: "none",   group: [3,7] },
  zombie:       { name: "ゾンビ",       hp: 22, ac: 8,  atk: 6,  dice: 4,  exp: 14,  gold: 12,  skill: "slow",   group: [2,4] },
  cave_bat:     { name: "洞窟蝙蝠",     hp: 8,  ac: 11, atk: 4,  dice: 2,  exp: 6,   gold: 6,   skill: "none",   group: [4,8] },
  slime:        { name: "粘液体",       hp: 16, ac: 9,  atk: 5,  dice: 3,  exp: 10,  gold: 8,   skill: "acid",   group: [2,5] },
  cave_spider:  { name: "洞窟蜘蛛",     hp: 14, ac: 9,  atk: 6,  dice: 3,  exp: 11,  gold: 9,   skill: "poison", group: [2,5] },
  imp:          { name: "小悪魔",       hp: 12, ac: 10, atk: 7,  dice: 3,  exp: 12,  gold: 11,  skill: "none",   group: [2,4] },
  bandit:       { name: "山賊",         hp: 18, ac: 8,  atk: 8,  dice: 4,  exp: 15,  gold: 20,  skill: "ambush", group: [1,3] },
  mushroom_man: { name: "茸人",         hp: 20, ac: 9,  atk: 6,  dice: 3,  exp: 13,  gold: 10,  skill: "poison", group: [2,4] },
  toad:         { name: "毒ガマ",       hp: 15, ac: 10, atk: 5,  dice: 3,  exp: 9,   gold: 7,   skill: "poison", group: [2,5] },
  mud_bat:      { name: "泥蝙蝠",       hp: 10, ac: 11, atk: 5,  dice: 2,  exp: 7,   gold: 6,   skill: "none",   group: [3,7] },
  bone_dog:     { name: "骨の犬",       hp: 16, ac: 9,  atk: 7,  dice: 4,  exp: 13,  gold: 11,  skill: "none",   group: [2,4] },
  plague_rat:   { name: "疫病鼠",       hp: 13, ac: 10, atk: 5,  dice: 3,  exp: 9,   gold: 8,   skill: "poison", group: [3,6] },
  thug:         { name: "ごろつき",     hp: 22, ac: 8,  atk: 9,  dice: 5,  exp: 16,  gold: 22,  skill: "ambush", group: [1,4] },
  hollow:       { name: "虚無の亡者",   hp: 20, ac: 8,  atk: 7,  dice: 4,  exp: 14,  gold: 12,  skill: "none",   group: [2,4] },
  rust_sprite:  { name: "錆精霊",       hp: 11, ac: 10, atk: 6,  dice: 3,  exp: 10,  gold: 8,   skill: "drain",  group: [2,5] },
  cave_worm:    { name: "洞窟蟲",       hp: 24, ac: 7,  atk: 8,  dice: 5,  exp: 17,  gold: 14,  skill: "none",   group: [2,4] },
  // B2F - Tier 2
  gargoyle:        { name: "ガーゴイル",   hp: 30, ac: 6, atk: 11, dice: 6, exp: 30,  gold: 38,  skill: "guard",  group: [1,3] },
  wisp:            { name: "ウィスプ",     hp: 24, ac: 5, atk: 12, dice: 5, exp: 32,  gold: 35,  skill: "drain",  group: [1,4] },
  moth:            { name: "毒粉モス",     hp: 26, ac: 8, atk: 9,  dice: 4, exp: 28,  gold: 30,  skill: "poison", group: [2,5] },
  golem:           { name: "泥ゴーレム",   hp: 42, ac: 4, atk: 13, dice: 7, exp: 42,  gold: 45,  skill: "slam",   group: [1,2] },
  fire_elemental:  { name: "炎の精",       hp: 28, ac: 6, atk: 12, dice: 6, exp: 34,  gold: 38,  skill: "burn",   group: [1,3] },
  ice_sprite:      { name: "氷の精",       hp: 24, ac: 7, atk: 11, dice: 5, exp: 29,  gold: 32,  skill: "freeze", group: [2,4] },
  stone_snake:     { name: "石蛇",         hp: 30, ac: 5, atk: 13, dice: 6, exp: 36,  gold: 40,  skill: "poison", group: [1,3] },
  bronze_scarab:   { name: "青銅甲虫",     hp: 26, ac: 6, atk: 11, dice: 5, exp: 31,  gold: 35,  skill: "none",   group: [3,6] },
  crystal_fly:     { name: "水晶蝶",       hp: 22, ac: 7, atk: 10, dice: 5, exp: 28,  gold: 30,  skill: "drain",  group: [2,5] },
  hex_eye:         { name: "呪眼",         hp: 32, ac: 5, atk: 14, dice: 7, exp: 40,  gold: 44,  skill: "curse",  group: [1,2] },
  venom_moth:      { name: "猛毒蛾",       hp: 28, ac: 7, atk: 11, dice: 5, exp: 32,  gold: 36,  skill: "poison", group: [2,4] },
  amber_golem:     { name: "琥珀ゴーレム", hp: 44, ac: 4, atk: 14, dice: 7, exp: 45,  gold: 48,  skill: "slam",   group: [1,2] },
  sand_wraith:     { name: "砂の怨念",     hp: 26, ac: 6, atk: 12, dice: 6, exp: 33,  gold: 37,  skill: "drain",  group: [1,3] },
  cave_leech:      { name: "洞窟蛭",       hp: 24, ac: 8, atk: 10, dice: 4, exp: 27,  gold: 29,  skill: "drain",  group: [2,5] },
  rock_crab:       { name: "岩蟹",         hp: 34, ac: 4, atk: 13, dice: 7, exp: 38,  gold: 42,  skill: "guard",  group: [1,3] },
  mold_creep:      { name: "黴の這うもの", hp: 28, ac: 8, atk: 10, dice: 5, exp: 30,  gold: 32,  skill: "poison", group: [2,4] },
  dust_devil:      { name: "砂塵の悪魔",   hp: 22, ac: 7, atk: 12, dice: 5, exp: 31,  gold: 34,  skill: "none",   group: [2,4] },
  toxic_ooze:      { name: "毒の粘液",     hp: 30, ac: 9, atk: 9,  dice: 4, exp: 28,  gold: 30,  skill: "acid",   group: [1,3] },
  brass_knight:    { name: "真鍮の騎士",   hp: 38, ac: 4, atk: 14, dice: 7, exp: 44,  gold: 48,  skill: "guard",  group: [1,2] },
  jar_ghost:       { name: "壺の亡霊",     hp: 24, ac: 6, atk: 11, dice: 5, exp: 30,  gold: 33,  skill: "drain",  group: [1,3] },
  swarm_bee:       { name: "蜂の群れ",     hp: 20, ac: 8, atk: 10, dice: 4, exp: 26,  gold: 28,  skill: "poison", group: [2,5] },
  chaos_sprite:    { name: "混沌の精",     hp: 26, ac: 6, atk: 13, dice: 6, exp: 35,  gold: 39,  skill: "none",   group: [2,4] },
  magma_slug:      { name: "溶岩蛞蝓",     hp: 32, ac: 7, atk: 11, dice: 5, exp: 33,  gold: 36,  skill: "burn",   group: [2,4] },
  gloom_bat:       { name: "闇蝙蝠",       hp: 24, ac: 7, atk: 11, dice: 5, exp: 29,  gold: 31,  skill: "drain",  group: [2,5] },
  // B3F - Tier 3
  minotaur:     { name: "ミノタウロス",  hp: 56, ac: 4, atk: 17, dice: 8, exp: 64,  gold: 70,  skill: "slam",   group: [1,2] },
  warden:       { name: "牢獄番長",      hp: 48, ac: 3, atk: 15, dice: 7, exp: 55,  gold: 60,  skill: "guard",  group: [1,3] },
  shade:        { name: "影の追跡者",    hp: 39, ac: 5, atk: 18, dice: 7, exp: 58,  gold: 66,  skill: "drain",  group: [1,4] },
  hound:        { name: "黒檻の猟犬",    hp: 42, ac: 6, atk: 19, dice: 8, exp: 62,  gold: 58,  skill: "bleed",  group: [2,4] },
  dark_knight:  { name: "暗黒騎士",      hp: 52, ac: 3, atk: 18, dice: 8, exp: 66,  gold: 72,  skill: "guard",  group: [1,2] },
  bone_mage:    { name: "骨の魔道士",    hp: 44, ac: 5, atk: 17, dice: 7, exp: 58,  gold: 64,  skill: "curse",  group: [1,3] },
  chain_ghost:  { name: "鎖の亡霊",      hp: 40, ac: 5, atk: 16, dice: 7, exp: 55,  gold: 62,  skill: "drain",  group: [1,3] },
  stone_troll:  { name: "石のトロル",    hp: 64, ac: 3, atk: 20, dice: 9, exp: 75,  gold: 80,  skill: "slam",   group: [1,2] },
  cave_bear:    { name: "洞窟熊",        hp: 60, ac: 4, atk: 19, dice: 8, exp: 70,  gold: 76,  skill: "slam",   group: [1,2] },
  wolf_shade:   { name: "狼の霊魂",      hp: 44, ac: 5, atk: 18, dice: 8, exp: 60,  gold: 66,  skill: "bleed",  group: [2,3] },
  plague_doc:   { name: "疫病博士",      hp: 46, ac: 4, atk: 16, dice: 7, exp: 62,  gold: 68,  skill: "poison", group: [1,2] },
  prison_guard: { name: "牢番",          hp: 50, ac: 3, atk: 17, dice: 8, exp: 65,  gold: 72,  skill: "guard",  group: [1,3] },
  iron_claw:    { name: "鉄爪",          hp: 54, ac: 3, atk: 19, dice: 9, exp: 68,  gold: 74,  skill: "bleed",  group: [1,2] },
  mist_hag:     { name: "霧の老婆",      hp: 42, ac: 5, atk: 18, dice: 8, exp: 62,  gold: 68,  skill: "drain",  group: [1,3] },
  eye_beast:    { name: "眼球獣",        hp: 48, ac: 4, atk: 20, dice: 8, exp: 70,  gold: 76,  skill: "curse",  group: [1,2] },
  shadow_dog:   { name: "影の猟犬",      hp: 46, ac: 5, atk: 19, dice: 8, exp: 64,  gold: 70,  skill: "bleed",  group: [2,4] },
  dungeon_rat:  { name: "地下鼠",        hp: 40, ac: 6, atk: 16, dice: 7, exp: 55,  gold: 60,  skill: "poison", group: [3,5] },
  rot_walker:   { name: "腐敗歩き",      hp: 52, ac: 4, atk: 17, dice: 8, exp: 63,  gold: 69,  skill: "poison", group: [2,3] },
  blood_moth:   { name: "血染め蛾",      hp: 44, ac: 5, atk: 17, dice: 7, exp: 60,  gold: 66,  skill: "bleed",  group: [2,4] },
  tomb_bat:     { name: "墓場蝙蝠",      hp: 40, ac: 6, atk: 16, dice: 7, exp: 55,  gold: 60,  skill: "drain",  group: [3,5] },
  ruin_warden:  { name: "廃墟の番人",    hp: 56, ac: 3, atk: 18, dice: 8, exp: 67,  gold: 73,  skill: "guard",  group: [1,2] },
  hex_hand:     { name: "呪いの手",      hp: 42, ac: 5, atk: 19, dice: 8, exp: 64,  gold: 70,  skill: "curse",  group: [1,3] },
  mud_troll:    { name: "泥トロル",      hp: 62, ac: 3, atk: 19, dice: 9, exp: 73,  gold: 79,  skill: "slam",   group: [1,2] },
  cave_horror:  { name: "洞窟の恐怖",    hp: 58, ac: 3, atk: 20, dice: 9, exp: 72,  gold: 78,  skill: "bleed",  group: [1,2] },
  // B4F - Tier 4
  dragon:        { name: "老いた竜",     hp: 78,  ac: 2,  atk: 23, dice: 10, exp: 110, gold: 130, skill: "breath", group: [1,2] },
  banshee:       { name: "バンシー",     hp: 55,  ac: 4,  atk: 21, dice: 8,  exp: 95,  gold: 104, skill: "drain",  group: [1,3] },
  lich:          { name: "リッチ",       hp: 66,  ac: 3,  atk: 24, dice: 9,  exp: 130, gold: 150, skill: "curse",  group: [1,2] },
  mimic:         { name: "ミミック",     hp: 60,  ac: 2,  atk: 25, dice: 10, exp: 125, gold: 180, skill: "trap",   group: [1,1] },
  vampire:       { name: "吸血鬼",       hp: 72,  ac: 2,  atk: 24, dice: 10, exp: 118, gold: 138, skill: "drain",  group: [1,2] },
  wyvern:        { name: "ワイバーン",   hp: 80,  ac: 2,  atk: 25, dice: 10, exp: 122, gold: 142, skill: "breath", group: [1,2] },
  basilisk:      { name: "バシリスク",   hp: 68,  ac: 3,  atk: 22, dice: 9,  exp: 110, gold: 128, skill: "curse",  group: [1,2] },
  medusa:        { name: "メデューサ",   hp: 65,  ac: 3,  atk: 23, dice: 9,  exp: 115, gold: 135, skill: "curse",  group: [1,2] },
  bone_lord:     { name: "骨の王",       hp: 82,  ac: 1,  atk: 26, dice: 11, exp: 135, gold: 158, skill: "curse",  group: [1,2] },
  death_knight:  { name: "死の騎士",     hp: 88,  ac: 1,  atk: 27, dice: 11, exp: 140, gold: 164, skill: "guard",  group: [1,2] },
  necromancer:   { name: "死霊術師",     hp: 70,  ac: 2,  atk: 25, dice: 10, exp: 128, gold: 148, skill: "curse",  group: [1,2] },
  gold_golem:    { name: "金ゴーレム",   hp: 96,  ac: 0,  atk: 28, dice: 12, exp: 148, gold: 175, skill: "slam",   group: [1,1] },
  chaos_knight:  { name: "混沌騎士",     hp: 84,  ac: 1,  atk: 26, dice: 11, exp: 136, gold: 160, skill: "guard",  group: [1,2] },
  shadow_dragon: { name: "影竜",         hp: 90,  ac: 0,  atk: 27, dice: 12, exp: 145, gold: 170, skill: "breath", group: [1,1] },
  void_eye:      { name: "虚空の眼",     hp: 66,  ac: 2,  atk: 24, dice: 10, exp: 120, gold: 140, skill: "curse",  group: [1,2] },
  plague_knight: { name: "疫病騎士",     hp: 76,  ac: 2,  atk: 25, dice: 10, exp: 125, gold: 145, skill: "poison", group: [1,2] },
  flame_lich:    { name: "炎のリッチ",   hp: 74,  ac: 2,  atk: 26, dice: 10, exp: 132, gold: 152, skill: "curse",  group: [1,1] },
  iron_golem:    { name: "鉄ゴーレム",   hp: 100, ac: -1, atk: 28, dice: 12, exp: 150, gold: 178, skill: "slam",   group: [1,1] },
  rune_guardian: { name: "ルーン守護者", hp: 85,  ac: 1,  atk: 27, dice: 11, exp: 138, gold: 162, skill: "guard",  group: [1,2] },
  elder_mimic:   { name: "老ミミック",   hp: 78,  ac: 1,  atk: 26, dice: 11, exp: 133, gold: 182, skill: "trap",   group: [1,1] },
  void_slime:    { name: "虚空の粘液",   hp: 64,  ac: 3,  atk: 22, dice: 9,  exp: 112, gold: 130, skill: "acid",   group: [1,2] },
  cursed_armor:  { name: "呪われた鎧",   hp: 86,  ac: 1,  atk: 27, dice: 11, exp: 138, gold: 160, skill: "guard",  group: [1,1] },
  death_moth:    { name: "死神蛾",       hp: 68,  ac: 2,  atk: 23, dice: 10, exp: 114, gold: 132, skill: "drain",  group: [1,3] },
  sin_eater:     { name: "罪喰い",       hp: 75,  ac: 2,  atk: 25, dice: 10, exp: 126, gold: 146, skill: "drain",  group: [1,2] },
  arch_wisp:     { name: "大ウィスプ",   hp: 70,  ac: 2,  atk: 24, dice: 10, exp: 118, gold: 138, skill: "drain",  group: [1,2] },
  // B5F - Tier 5
  angel:          { name: "光の精霊",     hp: 72,  ac: 2,  atk: 24, dice: 9,  exp: 145, gold: 160, skill: "breath", group: [1,3] },
  mirror:         { name: "公の幻影",     hp: 78,  ac: 1,  atk: 26, dice: 10, exp: 160, gold: 175, skill: "mirror", group: [1,2] },
  guardian:       { name: "玉座の守護者", hp: 92,  ac: 0,  atk: 28, dice: 11, exp: 180, gold: 210, skill: "guard",  group: [1,2] },
  oracle:         { name: "勇者の神託",   hp: 76,  ac: 1,  atk: 30, dice: 10, exp: 190, gold: 200, skill: "curse",  group: [1,3] },
  fallen_angel:   { name: "堕天使",       hp: 82,  ac: 1,  atk: 26, dice: 10, exp: 155, gold: 170, skill: "drain",  group: [1,2] },
  demon_lord:     { name: "悪魔公爵",     hp: 110, ac: -1, atk: 31, dice: 13, exp: 195, gold: 220, skill: "hero",   group: [1,1] },
  void_dragon:    { name: "虚空竜",       hp: 120, ac: -2, atk: 33, dice: 13, exp: 210, gold: 240, skill: "breath", group: [1,1] },
  holy_knight:    { name: "聖騎士",       hp: 88,  ac: 0,  atk: 28, dice: 11, exp: 175, gold: 192, skill: "guard",  group: [1,2] },
  dark_oracle:    { name: "闇の神託",     hp: 80,  ac: 1,  atk: 27, dice: 10, exp: 168, gold: 185, skill: "curse",  group: [1,2] },
  soul_reaper:    { name: "魂の刈人",     hp: 90,  ac: 0,  atk: 30, dice: 12, exp: 185, gold: 205, skill: "drain",  group: [1,1] },
  divine_beast:   { name: "神聖獣",       hp: 100, ac: -1, atk: 30, dice: 12, exp: 190, gold: 210, skill: "breath", group: [1,1] },
  chaos_lord:     { name: "混沌の君",     hp: 108, ac: -1, atk: 32, dice: 13, exp: 200, gold: 225, skill: "hero",   group: [1,1] },
  archdemon:      { name: "大悪魔",       hp: 115, ac: -2, atk: 33, dice: 13, exp: 205, gold: 230, skill: "curse",  group: [1,1] },
  storm_angel:    { name: "嵐天使",       hp: 85,  ac: 0,  atk: 29, dice: 11, exp: 178, gold: 195, skill: "breath", group: [1,2] },
  death_angel:    { name: "死天使",       hp: 88,  ac: 0,  atk: 30, dice: 11, exp: 182, gold: 200, skill: "drain",  group: [1,2] },
  void_knight:    { name: "虚空騎士",     hp: 92,  ac: -1, atk: 29, dice: 12, exp: 185, gold: 205, skill: "guard",  group: [1,1] },
  holy_golem:     { name: "聖ゴーレム",   hp: 105, ac: -1, atk: 30, dice: 12, exp: 192, gold: 215, skill: "slam",   group: [1,1] },
  curse_mage:     { name: "呪詛使い",     hp: 82,  ac: 1,  atk: 28, dice: 11, exp: 172, gold: 190, skill: "curse",  group: [1,2] },
  doom_guardian:  { name: "破滅の守護者", hp: 98,  ac: -1, atk: 31, dice: 12, exp: 188, gold: 208, skill: "guard",  group: [1,1] },
  pale_rider:     { name: "蒼白の騎者",   hp: 86,  ac: 0,  atk: 29, dice: 11, exp: 180, gold: 198, skill: "bleed",  group: [1,2] },
  star_warden:    { name: "星の番人",     hp: 95,  ac: 0,  atk: 30, dice: 12, exp: 186, gold: 205, skill: "guard",  group: [1,1] },
  abyss_eye:      { name: "深淵の眼",     hp: 78,  ac: 1,  atk: 27, dice: 10, exp: 165, gold: 182, skill: "curse",  group: [1,2] },
  eternal_knight: { name: "永遠の騎士",   hp: 102, ac: -1, atk: 31, dice: 12, exp: 192, gold: 214, skill: "guard",  group: [1,1] },
  sin_dragon:     { name: "罪竜",         hp: 118, ac: -2, atk: 33, dice: 13, exp: 208, gold: 238, skill: "breath", group: [1,1] },
  ruin_lord:      { name: "廃墟の王",     hp: 95,  ac: 0,  atk: 30, dice: 12, exp: 188, gold: 208, skill: "curse",  group: [1,1] },
  dark_lord:      { name: "闇の王",       hp: 125, ac: -2, atk: 34, dice: 14, exp: 215, gold: 245, skill: "hero",   group: [1,1] },
  // Boss
  boss: { name: "腐敗した勇者アレックス", hp: 360, ac: -2, atk: 34, dice: 14, exp: 0, gold: 0, skill: "hero", group: [1,1] }
};

const NAMED_ALLIES = {
  ralmhas: {
    id: "ralmhas", name: "ラルハス", cls: "fighter", className: "戦士", align: "中",
    lv: 9,
    hp: 158, maxHp: 158,
    mp: [0, 0, 0], maxMp: [0, 0, 0],
    atk: 28, baseAc: 1,
    int: 5, pie: 6, agi: 14,
    exp: 0,
    status: {},
    equip: { weapon: "muramasaShard", armor: "chain", accessory: "ring" },
    isNamedAlly: true,
    greeting: [
      "ラルハス：「……また生き延びてしまったか。」",
      "ラルハス：「貴様らなら使える。道連れにしてやる。」"
    ]
  }
};

const CHESTS = {
  b1: { gold: [60, 120],   item: "potion",       trap: 22 },
  b2: { gold: [130, 240],  item: "ether",        equip: "shuriken",    cursedEquip: "cursedBlade", cursedChance: 12, trap: 32 },
  b3: { gold: [220, 380],  item: "stoneCure",    trap: 42 },
  b4: { gold: [420, 720],  item: "malorScroll",  equip: "muramasaShard", cursedEquip: "hexArmor", cursedChance: 18, trap: 52 },
  battle: { gold: [30, 180], item: "potion",     trap: 35 }
};

let state;
let mode = "title";
let battle = null;
let chest = null;
let message = "";
let frame = 0;
let _recruitPending = null;
let _hitFlash = 0;
let _dark = 0;
let _noSpell = 0;
const titleImage = new Image();
titleImage.src = "img/title.png";

function makeMember(template) {
  const c = CLASSES[template.cls];
  return {
    ...template,
    className: c.label,
    lv: 1,
    exp: 0,
    hp: c.hp,
    maxHp: c.hp,
    mp: [...c.mp],
    maxMp: [...c.mp],
    atk: c.atk,
    baseAc: c.ac,
    int: c.int,
    pie: c.pie,
    agi: c.agi,
    status: {},
    equip: {
      weapon: template.cls === "mage" || template.cls === "priest" ? "shortSword" : "longSword",
      armor: template.cls === "mage" ? "robe" : "chain",
      accessory: null
    }
  };
}

function newGame() {
  const start = FLOORS[0].start;
  state = {
    floor: 0, x: start[0], y: start[1], dir: start[2],
    gold: 180, steps: 0, danger: 0, flags: {}, seen: {},
    inventory: { potion: 4, ether: 1, antidote: 1, stoneCure: 0, malorScroll: 1 },
    stock: { ring: 0, plate: 0, muramasaShard: 0 },
    party: partyTemplate.map(makeMember),
    lastChest: null
  };
  mode = "explore";
  battle = null;
  chest = null;
  message = "デスフォール入口。六人の隊列が、石の胃袋へ飲み込まれていく。";
  reveal();
  render();
}

function saveGame() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  message = "冒険の記録を保存した。";
  render();
}

function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!saved || !saved.party) return false;
    state = saved;
    mode = "explore";
    message = "冒険の記録を読み込んだ。";
    reveal();
    render();
    return true;
  } catch {
    return false;
  }
}

function floor() { return FLOORS[state.floor]; }
function tileAt(x, y, f = floor()) { return f.map[y]?.[x] || "#"; }
function living() { return state.party.filter(p => p.hp > 0 && !p.status.lost); }
function frontRow() { return state.party.slice(0, 3).filter(p => p.hp > 0); }
function backRow() { return state.party.slice(3).filter(p => p.hp > 0); }
function acOf(p) {
  let ac = p.baseAc;
  for (const id of Object.values(p.equip)) if (id && EQUIPMENT[id]) ac += EQUIPMENT[id].ac;
  if (p.status.sleep) ac += 3;
  return ac;
}
function atkOf(p) {
  return p.atk + (EQUIPMENT[p.equip.weapon]?.atk || 0);
}
function eventKey(x = state.x, y = state.y) { return `${x},${y}`; }
function currentEvent() { return floor().events[eventKey()]; }

function reveal() {
  const key = `f${state.floor}`;
  state.seen[key] ||= {};
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (Math.abs(dx) + Math.abs(dy) <= 3) state.seen[key][`${state.x + dx},${state.y + dy}`] = true;
  }
}

function move(n) {
  if (mode !== "explore") return;
  const d = DIRS[state.dir];
  const nx = state.x + d.dx * n;
  const ny = state.y + d.dy * n;
  if (tileAt(nx, ny) === "#") {
    sfx.bump();
    message = "壁だ。";
    render();
    return;
  }
  sfx.step();
  state.x = nx; state.y = ny; state.steps += 1; state.danger += 1 + state.floor;
  if (_dark > 0) _dark--;
  if (_noSpell > 0) _noSpell--;
  tickStatuses();
  reveal();
  handleEvent();
  if (mode === "explore" && Math.random() < encounterRate()) startBattle();
  render();
}

function rotate(n) {
  if (mode !== "explore") return;
  sfx.turn();
  state.dir = (state.dir + n + 4) % 4;
  message = `${DIRS[state.dir].name}を向いた。`;
  render();
}

function encounterRate() {
  const thief = state.party.find(p => p.cls === "thief" && p.hp > 0);
  return Math.max(0.04, floor().encounter + Math.min(0.08, state.danger / 900) - (thief ? 0.015 : 0));
}

function tickStatuses() {
  const log = [];
  for (const p of living()) {
    if (p.status.poison) {
      p.hp = Math.max(1, p.hp - 2);
      log.push(`${p.name}は毒に蝕まれている。`);
    }
    if (p.status.bleed) {
      p.hp = Math.max(1, p.hp - 3);
      log.push(`${p.name}は出血している。`);
    }
    if (p.status.burn) {
      p.hp = Math.max(1, p.hp - 4);
      log.push(`${p.name}は炎に焼かれている。`);
      if (Math.random() < 0.3) delete p.status.burn;
    }
    if (p.status.slow) {
      if (Math.random() < 0.4) delete p.status.slow;
    }
  }
  if (log.length) message = log.join("\n");
}

function handleEvent() {
  const ev = currentEvent();
  if (!ev) {
    if (!message) message = "暗い通路が続く。";
    return;
  }
  const done = `e_${state.floor}_${eventKey()}`;
  if (ev.once && state.flags[done]) {
    message = "ここにはもう何もない。";
    return;
  }
  if (ev.need && !state.flags[ev.need]) {
    message = ev.locked || "封印されている。";
    return;
  }
  if (ev.type === "message") message = ev.text;
  if (ev.type === "trap") {
    for (const p of living()) p.hp = Math.max(1, p.hp - ev.damage);
    message = ev.text;
  }
  if (ev.type === "trapdoor") {
    sfx.bump();
    for (const p of living()) p.hp = Math.max(1, p.hp - ev.damage);
    const toFloor = Math.min(FLOORS.length - 1, state.floor + 1);
    message = ev.text;
    if (toFloor !== state.floor) { changeFloor(toFloor); return; }
  }
  if (ev.type === "flag") {
    state.flags[ev.flag] = true;
    message = ev.text;
  }
  if (ev.type === "rotate") {
    state.dir = Math.floor(Math.random() * 4);
    message = `${ev.text} （向き：${DIRS[state.dir].name}）`;
    sfx.turn();
  }
  if (ev.type === "dark") {
    _dark = ev.duration || 10;
    message = ev.text;
    sfx.curse();
  }
  if (ev.type === "spelltrap") {
    _noSpell = ev.duration || 6;
    message = ev.text;
    sfx.curse();
  }
  if (ev.type === "stairs") {
    changeFloor(ev.to);
    return;
  }
  if (ev.type === "chest") {
    openChest(CHESTS[ev.table], done);
    return;
  }
  if (ev.type === "ally") {
    const ally = NAMED_ALLIES[ev.id];
    if (!ally) return;
    if (state.party.find(p => p.id === ev.id)) {
      message = `${ally.name}は既にパーティにいる。`;
      if (ev.once) state.flags[done] = true;
    } else if (state.party.length >= 6) {
      showModal(`
        <h2 style="color:var(--gold)">${ally.name}</h2>
        <p>${ally.greeting.join("<br>")}</p>
        <p class="red">……しかしパーティは満員だ。隊列を整えてから再び来い。</p>
        <div class="actions"><button data-action="close">戻る</button></div>
      `);
    } else {
      const allyData = { ...ally };
      state.party.push(allyData);
      message = ally.greeting.join("\n") + `\n\nラルハスがパーティに加わった！`;
      if (ev.once) state.flags[done] = true;
    }
    return;
  }
  if (ev.type === "boss") startBattle("boss");
  if (ev.once) state.flags[done] = true;
}

function changeFloor(to) {
  sfx.stairs();
  _dark = 0; _noSpell = 0;
  state.floor = to;
  const s = FLOORS[to].start;
  state.x = s[0]; state.y = s[1]; state.dir = s[2];
  state.danger = Math.max(0, state.danger - 20);
  message = `${floor().name}へ進んだ。`;
  reveal();
}

function inspect() {
  if (mode !== "explore") return;
  message = "";
  handleEvent();
  if (!message) {
    const d = DIRS[state.dir];
    message = tileAt(state.x + d.dx, state.y + d.dy) === "#" ? "前方は壁。叩いても空洞音はない。" : "通路の奥から湿った風が来る。";
  }
  render();
}

function startBattle(forced = null) {
  mode = "battle";
  _hitFlash = 0;
  const id = forced || choose(floor().monsters);
  const m = MONSTERS[id];
  const count = forced === "boss" ? 1 : rand(m.group[0], m.group[1]);
  const ambush = m.skill === "ambush";
  const hasThief = state.party.some(p => p.cls === "thief" && p.hp > 0);
  battle = {
    id,
    round: 1,
    surprise: Math.random() < (ambush ? (hasThief ? 0.35 : 0.72) : (hasThief ? 0.04 : 0.12)),
    enemies: Array.from({ length: count }, (_, i) => ({ ...m, id: `${id}_${i}`, maxHp: m.hp, hp: m.hp, sleep: 0, silence: 0, weak: 0 }))
  };
  if (forced === "boss") sfx.boss(); else sfx.encounter();
  bgm.start();
  message = `${m.name} ${count}体が現れた！${battle.surprise ? "\n不意を打たれた！" : ""}`;
  if (m.skill === "trap") {
    const trapLog = [`${m.name}は宝箱に化けていた！罠が炸裂！`];
    const trapDmg = Math.max(8, Math.floor(m.atk * 0.8));
    for (const p of living()) damageParty(p, trapDmg, trapLog, `${m.name}の爆裂罠`);
    if (!living().length) return gameOver(trapLog);
    message = trapLog.join("\n");
    render();
  } else if (battle.surprise) {
    enemyRound([message]);
  } else {
    render();
  }
}

function choose(list) { return list[Math.floor(Math.random() * list.length)]; }
function liveEnemies() { return battle.enemies.filter(e => e.hp > 0); }

function playerRound(action = "attack", spellId = null) {
  if (mode !== "battle") return;
  const log = [];
  wakeAndPoison(log);
  if (action === "defend") {
    state.party.forEach(p => p.guard = p.hp > 0 ? 1 : 0);
    log.push("隊列は防御姿勢を取った。");
  } else if (action === "cast") {
    castBestSpell(spellId, log);
  } else if (action === "pray") {
    priestAction(log);
  } else if (action === "run") {
    const avgAgi = living().reduce((sum, p) => sum + p.agi, 0) / Math.max(1, living().length);
    if (battle.id === "boss") log.push("逃げ場はない。");
    else if (Math.random() < 0.48 + avgAgi / 90) {
      message = "退却に成功した。";
      endBattle();
      render();
      return;
    } else log.push("退却に失敗した。");
  } else {
    attackRound(log);
  }
  if (liveEnemies().length === 0) return victory(log);
  enemyRound(log);
}

function attackRound(log) {
  const actors = living().sort((a, b) => b.agi - a.agi);
  for (const p of actors) {
    const targets = liveEnemies();
    if (!targets.length) break;
    const e = targets[0];
    if (p.status.sleep) {
      log.push(`${p.name}は眠っている。`);
      continue;
    }
    const row = state.party.indexOf(p) < 3 ? "front" : "back";
    const canReach = row === "front" || CLASSES[p.cls]?.spell || CLASSES[p.cls]?.ranged || p.isMonster;
    if (!canReach) {
      log.push(`${p.name}は後列から届かない。`);
      continue;
    }
    const hit = Math.random() < hitRate(p.agi + p.lv * 2, e.ac);
    if (!hit) {
      sfx.miss();
      log.push(`${p.name}の攻撃は外れた。`);
      continue;
    }
    if (e.skill === "guard" && Math.random() < 0.22) {
      log.push(`${p.name}の攻撃を${e.name}は盾で弾いた。`);
      continue;
    }
    sfx.attack();
    const crit = p.cls === "samurai" && Math.random() < 0.08 + p.lv * 0.01;
    const dmg = crit ? e.hp : Math.max(1, atkOf(p) + rand(1, 6) + Math.floor(p.lv * 1.6) - Math.max(-2, e.ac));
    e.hp = Math.max(0, e.hp - dmg);
    _hitFlash = 1.0;
    log.push(`${p.name}の攻撃。${e.name}に${dmg}ダメージ${crit ? "。首を刎ねた！" : "。"}`);
  }
}

function castBestSpell(spellId, log) {
  if (_noSpell > 0) { log.push("魔封じの間では呪文が使えない。"); return; }
  const caster = living().find(p => (CLASSES[p.cls]?.spell === "mage" || CLASSES[p.cls]?.spell === "bishop") && p.mp.some(v => v > 0));
  if (!caster) {
    log.push("唱えられる魔術師がいない。");
    return;
  }
  const usable = SPELLS.mage.filter(s => caster.mp[s.lv - 1] > 0);
  const spell = spellId ? usable.find(s => s.id === spellId) : usable[usable.length - 1];
  if (!spell) {
    log.push("呪文回数が尽きている。");
    return;
  }
  caster.mp[spell.lv - 1] -= 1;
  applySpell(caster, spell, log);
}

function priestAction(log) {
  if (_noSpell > 0) { log.push("魔封じの間では祈りも届かない。"); return; }
  const caster = living().find(p => (CLASSES[p.cls]?.spell === "priest" || CLASSES[p.cls]?.spell === "bishop") && p.mp.some(v => v > 0));
  if (!caster) {
    log.push("祈れる僧侶がいない。");
    return;
  }
  const wounded = living().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  const spell = caster.mp[2] > 0 && wounded.hp < wounded.maxHp * 0.35 ? SPELLS.priest[4]
    : caster.mp[1] > 0 && state.party.some(p => p.status.poison || p.status.paralyze) ? SPELLS.priest[3]
    : SPELLS.priest.find(s => s.id === "dios");
  if (!spell || caster.mp[spell.lv - 1] <= 0) {
    log.push("祈りの力が残っていない。");
    return;
  }
  caster.mp[spell.lv - 1] -= 1;
  applySpell(caster, spell, log);
}

function applySpell(caster, spell, log) {
  sfx.spell();
  if (spell.kind === "heal" || spell.kind === "fullheal") {
    const target = living().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] || caster;
    const heal = spell.kind === "fullheal" ? target.maxHp : spell.power + caster.pie + rand(0, 8);
    target.hp = Math.min(target.maxHp, target.hp + heal);
    delete target.status.poison; delete target.status.paralyze; delete target.status.bleed; delete target.status.burn; delete target.status.slow;
    log.push(`${caster.name}は${spell.name}を唱えた。${target.name}が回復した。`);
    return;
  }
  if (spell.kind === "cure") {
    state.party.forEach(p => { delete p.status.poison; delete p.status.paralyze; delete p.status.bleed; delete p.status.burn; delete p.status.slow; });
    log.push(`${caster.name}は${spell.name}を唱えた。毒と麻痺が消えた。`);
    return;
  }
  const targets = spell.target === "one" ? liveEnemies().slice(0, 1) : liveEnemies();
  if (spell.kind === "damage") {
    for (const e of targets) {
      const dmg = Math.max(3, spell.power + Math.floor(caster.int * 1.2) + rand(-5, 8) - Math.max(0, e.ac));
      e.hp = Math.max(0, e.hp - dmg);
      _hitFlash = 1.0;
      log.push(`${caster.name}の${spell.name}。${e.name}に${dmg}ダメージ。`);
    }
  }
  if (spell.kind === "sleep") {
    for (const e of targets) if (Math.random() < 0.55) e.sleep = 2;
    log.push(`${caster.name}は${spell.name}を唱えた。眠りの霧が広がる。`);
  }
  if (spell.kind === "weaken") {
    for (const e of targets) e.weak += 2;
    log.push(`${caster.name}は${spell.name}を唱えた。敵の姿が揺らいだ。`);
  }
  if (spell.kind === "silence") {
    for (const e of targets) if (Math.random() < 0.5) e.silence = 3;
    log.push(`${caster.name}は${spell.name}を唱えた。敵の呪文を封じた。`);
  }
}

function enemyRound(log) {
  for (const e of liveEnemies()) {
    if (e.sleep) {
      e.sleep -= 1;
      log.push(`${e.name}は眠っている。`);
      continue;
    }
    const targets = frontRow().length ? frontRow() : living();
    const target = choose(targets);
    if (!target) return gameOver(log);
    if (e.skill === "breath" && Math.random() < 0.28) {
      const dmg = Math.max(5, Math.floor(e.atk * 0.65));
      for (const p of living()) damageParty(p, dmg, log, `${e.name}のブレス`);
      continue;
    }
    if (e.skill === "curse" && !e.silence && Math.random() < 0.28) {
      sfx.curse();
      const victim = choose(living());
      victim.status.paralyze = 1;
      log.push(`${e.name}の呪い。${victim.name}は麻痺した。`);
      continue;
    }
    if (e.skill === "hero" && Math.random() < 0.32) {
      log.push(`${e.name}の怒涛の連撃！`);
      for (let h = 0; h < 3; h++) {
        const t = choose(frontRow().length ? frontRow() : living());
        if (!t) break;
        const dmg = Math.max(1, e.dice + rand(1, 6) - Math.floor(acOf(t) / 2));
        damageParty(t, dmg, log, `${e.name}の連撃`);
      }
      if (!living().length) return gameOver(log);
      continue;
    }
    const hit = Math.random() < hitRate(e.atk, acOf(target));
    if (!hit) {
      log.push(`${e.name}の攻撃は外れた。`);
      continue;
    }
    let dmg = Math.max(1, e.dice + rand(1, 8) - Math.floor(acOf(target) / 2));
    if (e.skill === "slam" && Math.random() < 0.25) dmg = Math.floor(dmg * 1.7);
    damageParty(target, dmg, log, `${e.name}の攻撃`);
    if (e.skill === "poison" && target.hp > 0 && Math.random() < 0.35) {
      target.status.poison = 1;
      log.push(`${target.name}は毒を受けた。`);
    }
    if (e.skill === "drain" && target.hp > 0 && Math.random() < 0.25) {
      e.hp = Math.min(e.maxHp, e.hp + Math.floor(dmg / 2));
      log.push(`${e.name}は生命力を吸った。`);
      if (target.lv > 1 && Math.random() < 0.20) {
        target.lv = Math.max(1, target.lv - 1);
        target.exp = 0;
        target.maxHp = Math.max(1, target.maxHp - rand(2, 5));
        target.hp = Math.min(target.hp, target.maxHp);
        sfx.curse();
        log.push(`${target.name}はレベルを奪われた！（Lv${target.lv}）`);
      }
    }
    if (e.skill === "mirror" && Math.random() < 0.35) {
      const reflectDmg = Math.max(1, Math.floor(dmg * 0.5));
      const reflectTarget = choose(living());
      if (reflectTarget) {
        damageParty(reflectTarget, reflectDmg, log, `${e.name}の反射`);
      }
    }
    if (e.skill === "bleed" && target.hp > 0 && Math.random() < 0.30) {
      target.status.bleed = 1;
      log.push(`${target.name}は出血した。`);
    }
    if (e.skill === "burn" && target.hp > 0 && Math.random() < 0.30) {
      target.status.burn = 1;
      log.push(`${target.name}は炎上した。`);
    }
    if (e.skill === "freeze" && target.hp > 0 && Math.random() < 0.25) {
      target.status.paralyze = 1;
      log.push(`${target.name}は凍りついた。`);
    }
    if (e.skill === "slow" && target.hp > 0 && Math.random() < 0.30) {
      target.status.slow = 1;
      log.push(`${target.name}は鈍化した。`);
    }
    if (e.skill === "acid" && target.hp > 0 && Math.random() < 0.25) {
      target.status.poison = 1;
      log.push(`${target.name}は酸を浴びた。`);
    }
  }
  if (!living().length) return gameOver(log);
  battle.round += 1;
  message = log.join("\n");
  render();
}

function wakeAndPoison(log) {
  for (const p of state.party) {
    p.guard = 0;
    if (p.hp <= 0) continue;
    if (p.status.sleep) {
      p.status.sleep -= 1;
      if (p.status.sleep <= 0) delete p.status.sleep;
    }
    if (p.status.poison) p.hp = Math.max(1, p.hp - 3);
  }
}

function damageParty(p, amount, log, source) {
  sfx.hit();
  const dmg = Math.max(1, Math.floor(amount * (p.guard ? 0.45 : 1)));
  p.hp = Math.max(0, p.hp - dmg);
  log.push(`${source}。${p.name}に${dmg}ダメージ。`);
  if (p.hp <= 0 && !p.dead) {
    const brutal = dmg >= p.maxHp * 0.75 || source.includes("連撃") || source.includes("ブレス");
    p.dead = (brutal && Math.random() < 0.28) ? "ashes" : "dead";
    log.push(p.dead === "ashes" ? `${p.name}の遺体は灰と化した…` : `${p.name}は倒れた。`);
  }
}

function hitRate(power, ac) {
  return Math.max(0.12, Math.min(0.9, 0.58 + power * 0.018 - ac * 0.035));
}

function victory(log) {
  bgm.stop();
  const exp = battle.enemies.reduce((s, e) => s + e.exp, 0);
  const gold = battle.enemies.reduce((s, e) => s + e.gold, 0) + rand(0, 40);
  if (battle.id === "boss") {
    sfx.victory();
    mode = "ending";
    message = "腐敗した勇者アレックスを倒した。玉座の間に、六人の足音だけが残る。";
    showEnding();
    return render();
  }
  sfx.victory();
  state.gold += gold;
  for (const p of living()) {
    p.exp += exp;
    levelUp(p, log);
  }
  log.push(`勝利。${exp}EXPと${gold}Gを得た。`);
  const hasChest = Math.random() < 0.45;
  if (tryRecruitment(log.join("\n"), hasChest)) return;
  if (hasChest) { openChest(CHESTS.battle, null, log.join("\n")); return; }
  endBattle();
  message = log.join("\n");
  render();
}

function tryRecruitment(logStr, hasChest) {
  const rates = [0.16, 0.12, 0.08, 0.04, 0.02];
  const rate = rates[state.floor] || 0.02;
  const candidates = battle.enemies.filter(e => e.hp <= 0 && MONSTERS[e.id] && e.exp > 0);
  if (!candidates.length || Math.random() >= rate) return false;
  const c = candidates[Math.floor(Math.random() * candidates.length)];
  _recruitPending = { id: c.id, name: c.name, log: logStr, hasChest };
  showModal(`
    <h2 style="color:var(--red)">${c.name}</h2>
    <p style="margin:12px 0">倒れたはずの<span class="gold">${c.name}</span>がゆっくりと立ち上がり、こちらを見ている……</p>
    <p class="dim">（パーティ上限6名）</p>
    <div class="actions">
      <button data-action="recruit">仲間に加える</button>
      <button data-action="skipRecruit">断る</button>
    </div>
  `);
  return true;
}

function doRecruit() {
  if (!_recruitPending) return;
  const { id, name, log, hasChest } = _recruitPending;
  _recruitPending = null;
  overlayEl.classList.remove("show");
  const m = MONSTERS[id];
  let extra = "";
  if (state.party.length < 6) {
    state.party.push({
      id, name: m.name, cls: "monster", className: "魔物", align: "中",
      lv: 1, exp: 0, hp: m.hp, maxHp: m.hp,
      mp: [0,0,0], maxMp: [0,0,0],
      atk: m.atk, baseAc: m.ac, int: 5, pie: 5, agi: 8,
      status: {}, equip: { weapon: null, armor: null, accessory: null },
      isMonster: true, skill: m.skill
    });
    extra = `\n${m.name}が仲間になった！`;
  } else {
    extra = `\n${m.name}を加えたいが、仲間が満員だ。`;
  }
  if (hasChest) { openChest(CHESTS.battle, null, log + extra); return; }
  endBattle();
  message = log + extra;
  render();
}

function skipRecruit() {
  if (!_recruitPending) return;
  const { log, hasChest } = _recruitPending;
  _recruitPending = null;
  overlayEl.classList.remove("show");
  if (hasChest) { openChest(CHESTS.battle, null, log); return; }
  endBattle();
  message = log;
  render();
}

function levelUp(p, log) {
  while (p.exp >= p.lv * 85) {
    p.exp -= p.lv * 85;
    p.lv += 1;
    p.maxHp += rand(5, 10) + (p.cls === "fighter" ? 4 : 0);
    p.hp = p.maxHp;
    p.atk += p.cls === "mage" ? 1 : 2;
    p.baseAc = Math.max(-4, p.baseAc - (p.cls === "fighter" ? 1 : 0));
    p.int += p.cls === "mage" ? 2 : 1;
    p.pie += p.cls === "priest" ? 2 : 1;
    p.agi += p.cls === "thief" ? 2 : 1;
    const c = CLASSES[p.cls];
    if (c?.spell) {
      p.maxMp = p.maxMp.map((v, i) => v + (p.lv > i * 3 ? 1 : 0));
      p.mp = [...p.maxMp];
    }
    sfx.levelup();
    log.push(`${p.name}はレベル${p.lv}になった。`);
  }
}

function endBattle() {
  bgm.stop();
  battle = null;
  chest = null;
  mode = "explore";
  state.danger = Math.max(0, state.danger - 16);
}

function gameOver(log = []) {
  bgm.stop();
  mode = "gameover";
  battle = null;
  chest = null;
  message = [...log, "全滅した。寺院に運び込む者もいない。"].join("\n");
  render();
}

function openChest(table, doneFlag = null, prefix = "") {
  sfx.chest();
  mode = "chest";
  chest = { table, doneFlag, inspected: false, disarmed: false, trap: Math.random() * 100 < table.trap, prefix };
  message = `${prefix ? prefix + "\n" : ""}宝箱を見つけた。罠の気配がする。`;
  render();
}

function inspectChest() {
  if (mode !== "chest") return;
  chest.inspected = true;
  const thief = state.party.find(p => p.cls === "thief" && p.hp > 0);
  const chance = thief ? 0.72 + thief.lv * 0.025 : 0.35;
  const truth = Math.random() < chance;
  message = truth ? (chest.trap ? "ベルクは罠を見抜いた。針と魔法線がある。" : "罠はないようだ。") : "判定に自信がない。何か見落としたかもしれない。";
  render();
}

function disarmChest() {
  if (mode !== "chest") return;
  const thief = state.party.find(p => p.cls === "thief" && p.hp > 0);
  const chance = thief ? 0.62 + thief.lv * 0.035 : 0.22;
  if (chest.trap && Math.random() > chance) {
    springTrap();
    return;
  }
  chest.disarmed = true;
  chest.trap = false;
  message = "罠を外した。";
  render();
}

function lootChest(force = false) {
  if (mode !== "chest") return;
  if (chest.trap && !force && !chest.disarmed) springTrap();
  const t = chest.table;
  const gold = rand(t.gold[0], t.gold[1]);
  state.gold += gold;
  const got = [];
  if (t.item) { state.inventory[t.item] = (state.inventory[t.item] || 0) + 1; got.push(ITEMS[t.item].name); }
  if (t.equip && Math.random() < 0.55) { state.stock[t.equip] = (state.stock[t.equip] || 0) + 1; got.push(EQUIPMENT[t.equip].name); }
  if (t.cursedEquip && Math.random() * 100 < (t.cursedChance || 0)) {
    const cursedId = t.cursedEquip;
    const ceq = EQUIPMENT[cursedId];
    const victim = choose(living());
    if (victim) {
      const oldId = victim.equip[ceq.type];
      if (oldId) state.stock[oldId] = (state.stock[oldId] || 0) + 1;
      victim.equip[ceq.type] = cursedId;
      victim.cursedSlot = ceq.type;
      got.push(`⚠${ceq.name}（${victim.name}に呪縛！）`);
    }
  }
  if (chest.doneFlag) state.flags[chest.doneFlag] = true;
  const prefix = chest.prefix || "";
  endBattle();
  message = `${prefix ? prefix + "\n" : ""}宝箱を開けた。${gold}G${got.length ? "と" + got.join("、") : ""}を得た。`;
  render();
}

function springTrap() {
  const trap = choose(["毒針", "石弓", "爆裂", "ガス"]);
  const log = [`罠だ！ ${trap}が作動した。`];
  if (trap === "毒針") {
    const p = choose(living());
    p.status.poison = 1;
    damageParty(p, rand(6, 14), log, "毒針");
  } else if (trap === "ガス") {
    for (const p of living()) p.status.sleep = 2;
    log.push("眠りのガスが広がった。");
  } else {
    for (const p of living()) damageParty(p, rand(5, 14), log, trap);
  }
  chest.trap = false;
  message = log.join("\n");
  if (!living().length) gameOver(log);
  else render();
}

function useItem(id) {
  if ((state.inventory[id] || 0) <= 0) {
    message = "その道具はない。";
    return render();
  }
  const target = living().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] || state.party[0];
  state.inventory[id] -= 1;
  if (id === "potion") target.hp = Math.min(target.maxHp, target.hp + 45);
  if (id === "ether") {
    const caster = state.party.find(p => p.maxMp?.some(v => v > 0));
    if (caster) caster.mp = caster.mp.map((v, i) => Math.min(caster.maxMp[i], v + 1));
  }
  if (id === "antidote") state.party.forEach(p => delete p.status.poison);
  if (id === "stoneCure") state.party.forEach(p => delete p.status.paralyze);
  if (id === "malorScroll") return town("巻物で入口へ戻った。");
  message = `${ITEMS[id].name}を使った。`;
  render();
}

function town(extra = "") {
  mode = "explore";
  const s = FLOORS[0].start;
  state.floor = 0; state.x = s[0]; state.y = s[1]; state.dir = s[2]; state.danger = 0;
  reveal();
  message = extra || "入口の露店へ戻った。";
  render();
}

function rest() {
  const cost = 30 + state.party.reduce((s, p) => s + p.lv * 8, 0);
  if (state.gold < cost) {
    message = `宿代は${cost}G。足りない。`;
    return render();
  }
  state.gold -= cost;
  state.party.forEach(p => {
    if (p.hp > 0) {
      p.hp = p.maxHp;
      p.mp = [...p.maxMp];
      delete p.status.sleep;
    }
  });
  message = `馬小屋で休んだ。${cost}G支払った。`;
  render();
}

function decurse() {
  const cursed = state.party.find(p => p.cursedSlot);
  if (!cursed) { message = "寺院: 呪われた者はいない。"; return render(); }
  const cost = 600 + cursed.lv * 100;
  if (state.gold < cost) { message = `寺院: 呪い解きには${cost}G必要だ。`; return render(); }
  state.gold -= cost;
  const slot = cursed.cursedSlot;
  const eqId = cursed.equip[slot];
  cursed.equip[slot] = null;
  cursed.cursedSlot = undefined;
  message = `${cursed.name}の呪いが解けた。${EQUIPMENT[eqId]?.name || "装備"}が砕けた。${cost}Gを献金した。`;
  render();
}

function temple() {
  const candidates = state.party.filter(p => p.dead && p.dead !== "lost");
  if (!candidates.length) {
    const lostOnes = state.party.filter(p => p.dead === "lost");
    if (lostOnes.length) {
      message = `寺院: ${lostOnes.map(p => p.name).join("、")}は永遠に失われた。いかなる奇跡も届かぬ。`;
    } else {
      message = "寺院: 蘇生を待つ者はいない。";
    }
    return render();
  }
  const target = candidates[0];
  const isAshes = target.dead === "ashes";
  const cost = isAshes ? 500 + target.lv * 150 : 250 + target.lv * 80;
  if (state.gold < cost) {
    const stateLabel = isAshes ? "灰化" : "死亡";
    message = `寺院: ${target.name}(${stateLabel})の蘇生には${cost}G必要だ。`;
    return render();
  }
  state.gold -= cost;
  const successRate = isAshes
    ? Math.max(0.30, 0.60 - target.lv * 0.025)
    : Math.max(0.55, 0.85 - target.lv * 0.015);
  if (Math.random() < successRate) {
    target.hp = Math.max(1, Math.floor(target.maxHp / 2));
    target.status = {};
    const prevDead = target.dead;
    target.dead = undefined;
    if (isAshes) {
      const oldLv = target.lv;
      target.lv = Math.max(1, target.lv - 1);
      target.maxHp = Math.max(1, target.maxHp - rand(1, 4));
      message = `${target.name}は灰の中から蘇った。${cost}Gを献金した。\nただし力は衰え、Lv${oldLv}→${target.lv}に落ちた。`;
    } else {
      message = `${target.name}は蘇生した。${cost}Gを献金した。`;
    }
  } else {
    if (isAshes) {
      target.dead = "lost";
      message = `${target.name}の蘇生は失敗した。魂は完全に消え去り、ロストとなった…`;
    } else {
      target.dead = "ashes";
      message = `${target.name}の蘇生は失敗した。遺体は灰と化した…再度の儀式が必要だ。`;
    }
  }
  render();
}

function buy(kind, id) {
  const data = kind === "item" ? ITEMS[id] : EQUIPMENT[id];
  if (state.gold < data.price) {
    message = "金が足りない。";
    return render();
  }
  state.gold -= data.price;
  if (kind === "item") state.inventory[id] = (state.inventory[id] || 0) + 1;
  else state.stock[id] = (state.stock[id] || 0) + 1;
  message = `${data.name}を買った。`;
  render();
}

function equipBest() {
  for (const p of state.party) {
    for (const [id, count] of Object.entries(state.stock)) {
      if (count <= 0) continue;
      const e = EQUIPMENT[id];
      if (!e) continue;
      const slot = e.type;
      if (p.cursedSlot === slot) continue;
      const current = p.equip[slot];
      const better = slot === "weapon" ? e.atk > (EQUIPMENT[current]?.atk || 0) : e.ac < (EQUIPMENT[current]?.ac || 0);
      if (better) {
        if (current) state.stock[current] = (state.stock[current] || 0) + 1;
        p.equip[slot] = id;
        state.stock[id] -= 1;
      }
    }
  }
  message = "可能な限り良い装備に持ち替えた。";
  render();
}

function reorder() {
  state.party.push(state.party.shift());
  message = "隊列を入れ替えた。先頭が後列へ回った。";
  render();
}

function showCamp() {
  const inv = Object.entries(state.inventory).map(([id, n]) => `${ITEMS[id].name}x${n}`).join(" / ");
  const stock = Object.entries(state.stock).filter(([, n]) => n > 0).map(([id, n]) => `${EQUIPMENT[id].name}x${n}`).join(" / ") || "なし";
  showModal(`
    <h2>冒険者の町</h2>
    <p>G: <span class="gold">${state.gold}</span></p>
    <p>道具: ${inv}</p>
    <p>予備装備: ${stock}</p>
    <div class="actions">
      <button data-action="rest">宿屋</button>
      <button data-action="temple">寺院(蘇生)</button>
      <button data-action="decurse">寺院(呪解き)</button>
      <button data-action="transfer">転職</button>
      <button data-action="equip">装備最適化</button>
      <button data-action="reorder">隊列変更</button>
      <button data-action="save">保存</button>
      <button data-action="status">能力を見る</button>
      <button data-action="close">戻る</button>
    </div>
    <h2>商店</h2>
    <div class="actions">
      ${Object.entries(ITEMS).map(([id, it]) => `<button data-buy-kind="item" data-buy="${id}">${it.name} ${it.price}G</button>`).join("")}
      ${Object.entries(EQUIPMENT).filter(([id, it]) => !it.cursed && id !== "muramasaShard").map(([id, it]) => `<button data-buy-kind="equip" data-buy="${id}">${it.name} ${it.price}G</button>`).join("")}
    </div>
  `);
}

function showTransfer() {
  const transferable = Object.entries(CLASSES).filter(([id]) => id !== "monster");
  const rows = state.party.map((p, i) => {
    const opts = transferable
      .filter(([id]) => id !== p.cls)
      .map(([id, c]) => `<button data-action="dotransfer" data-member="${i}" data-cls="${id}">${c.label}へ</button>`)
      .join("");
    return `<p>${i + 1}. <span class="gold">${p.name}</span> ${p.className} Lv${p.lv} → ${opts}</p>`;
  }).join("");
  showModal(`
    <h2>訓練場 – 転職</h2>
    <p class="dim">転職するとLv1に戻るが、HPと呪文スロットは保持される。費用: 300G</p>
    ${rows}
    <div class="actions"><button data-action="close">戻る</button></div>
  `);
}

function doTransfer(memberIdx, newCls) {
  const p = state.party[memberIdx];
  if (!p) return;
  const cost = 300;
  if (state.gold < cost) { message = "転職費用が足りない（300G）。"; return render(); }
  if (p.dead) { message = `${p.name}は死んでいるため転職できない。`; return render(); }
  state.gold -= cost;
  const c = CLASSES[newCls];
  p.cls = newCls;
  p.className = c.label;
  p.lv = 1;
  p.exp = 0;
  p.atk = c.atk;
  p.baseAc = c.ac;
  p.int = c.int;
  p.pie = c.pie;
  p.agi = c.agi;
  if (c.spell) {
    p.maxMp = [...c.mp];
    p.mp = [...c.mp];
  } else {
    p.maxMp = [0, 0, 0];
    p.mp = [0, 0, 0];
  }
  message = `${p.name}は${c.label}に転職した。Lv1から再出発だ。`;
  closeModal();
  render();
}

function showStatus() {
  const rows = state.party.map((p, i) => {
    const stateStr = p.dead === "lost" ? '<span class="red">【ロスト】</span>'
      : p.dead === "ashes" ? '<span style="color:#ff9900">【灰】</span>'
      : p.dead === "dead" ? '<span class="red">【死亡】</span>'
      : "";
    const bad = Object.keys(p.status || {}).filter(k => p.status[k]).join(" ");
    const equip = Object.values(p.equip).filter(Boolean).map(id => EQUIPMENT[id]?.name || id).join(" ");
    return `<p>${i + 1}. <span class="gold">${p.name}</span> ${stateStr} ${p.className} Lv${p.lv} HP ${p.hp}/${p.maxHp} AC ${acOf(p)} ATK ${atkOf(p)} MP ${p.mp.join("/")}${bad ? ` <span class="red">${bad}</span>` : ""}${equip ? ` <span class="dim">[${equip}]</span>` : ""}</p>`;
  }).join("");
  showModal(`<h2>冒険者名簿</h2>${rows}<div class="actions"><button data-action="close">戻る</button></div>`);
}

function showMap() {
  const f = floor();
  const seen = state.seen[`f${state.floor}`] || {};
  const rows = f.map.map((row, y) => row.split("").map((ch, x) => {
    if (state.x === x && state.y === y) return "＠";
    if (!seen[`${x},${y}`]) return "　";
    return ch === "#" ? "■" : "・";
  }).join("")).join("<br>");
  showModal(`<h2>${f.name} 地図</h2><p style="line-height:1.05;font-size:16px">${rows}</p><div class="actions"><button data-action="close">戻る</button></div>`);
}

function showHelp() {
  showModal(`
    <h2>v3の遊び方</h2>
    <p>FC版Wizardryを意識し、6人隊列、AC、呪文回数、宝箱罠、寺院、宿屋、商店、地図、隊列変更を入れています。</p>
    <p>前列3人は通常攻撃が届きます。後列は魔法と祈りが主役です。盗賊が生きていると罠判定と遭遇率が楽になります。</p>
    <p>宝箱は「調査」「罠解除」「開ける」の順が基本。無理に開けると毒針や爆裂罠が来ます。</p>
    <div class="actions"><button data-action="close">戻る</button></div>
  `);
}

function showTitle() {
  showModal(`
    ${titleImage.complete && titleImage.naturalWidth ? `<img src="img/title.png" alt="タイトル画像">` : ""}
    <h1>サカムビット公の逆襲 v3</h1>
    <p>六人の隊列で大迷宮へ潜る、ファミコンWizardry寄せの版です。玄室、罠箱、宿屋、寺院、呪文回数、ACを追加しました。</p>
    <div class="actions">
      <button data-action="new">新しく始める</button>
      <button data-action="load">続きから</button>
      <button data-action="help">説明</button>
    </div>
  `, true);
}

function showEnding() {
  showModal(`
    <h1>逆襲、成る</h1>
    <p>勇者アレックスは倒れ、デスフォールの玉座は再び主を得た。</p>
    <p>サカムビット公は振り返る。勝利したのは王冠ではなく、六人の隊列だった。</p>
    <p class="gold">GAME CLEAR</p>
    <div class="actions"><button data-action="new">もう一度</button><button data-action="close">閉じる</button></div>
  `, true);
}

function showModal(html, persistent = false) {
  modalEl.innerHTML = html;
  overlayEl.classList.add("show");
  overlayEl.dataset.persistent = persistent ? "1" : "0";
}

function closeModal() {
  if (overlayEl.dataset.persistent === "1" && mode === "title") return;
  overlayEl.classList.remove("show");
}

function render() {
  drawScene();
  renderHud();
  renderCommands();
  msgEl.textContent = message;
}

function renderHud() {
  partyEl.innerHTML = state.party.map((p, i) => {
    const bad = Object.keys(p.status || {}).join(" ");
    let borderColor = p.isNamedAlly ? "#bf8cff" : p.isMonster ? "#ff6020" : null;
    let extraStyle = "";
    let deadLabel = "";
    if (p.dead === "ashes") { borderColor = "#ff9900"; deadLabel = "灰"; }
    else if (p.dead === "lost") { borderColor = "#333"; extraStyle = "opacity:0.38;"; deadLabel = "ロスト"; }
    const styleAttr = (borderColor || extraStyle)
      ? ` style="${borderColor ? `border-left-color:${borderColor};` : ""}${extraStyle}"`
      : "";
    const cursedMark = p.cursedSlot ? ' <span style="color:#ff9900">呪</span>' : "";
    return `<div class="member ${p.hp <= 0 ? "dead" : ""}"${styleAttr}>
      <div class="name">${i + 1} ${p.name} ${p.className}${cursedMark}</div>
      <div class="hp">HP ${p.hp}/${p.maxHp}</div>
      <div>AC ${acOf(p)} ATK ${atkOf(p)} MP ${p.mp.join("/")}</div>
      <div class="bad">${deadLabel || bad || p.align}</div>
    </div>`;
  }).join("");
  metaEl.innerHTML = `<div class="gold">${floor().name}</div>
    <div>向き ${DIRS[state.dir].name} / X${state.x} Y${state.y}</div>
    <div>G ${state.gold} / 歩数 ${state.steps}</div>
    <div>危険 ${state.danger} / 生存 ${living().length}/6</div>
    ${_dark > 0 ? `<div style="color:#ff9900">暗闇 残${_dark}歩</div>` : ""}
    ${_noSpell > 0 ? `<div style="color:#ff6666">魔封じ 残${_noSpell}歩</div>` : ""}`;
}

function renderCommands() {
  let list = [];
  if (mode === "explore") list = [["前進","forward"],["左","left"],["右","right"],["後退","back"],["調べる","inspect"],["町","camp"],["地図","map"],["保存","save"],["薬","item:potion"],["帰還","item:malorScroll"],["説明","help"]];
  if (mode === "battle") list = [["攻撃","attack"],["魔術","cast"],["祈り","pray"],["防御","defend"],["退却","run"],["薬","item:potion"],["香","item:ether"],["説明","help"]];
  if (mode === "chest") list = [["罠調査","chestInspect"],["罠解除","chestDisarm"],["開ける","chestLoot"],["放置","chestLeave"],["説明","help"]];
  if (mode === "gameover") list = [["新規","new"],["ロード","load"],["説明","help"]];
  if (mode === "ending")  list = [["新規","new"],["ロード","load"]];
  if (mode === "title") list = [["新規","new"],["ロード","load"],["説明","help"]];
  commandsEl.innerHTML = list.map(([label, cmd]) => `<button data-cmd="${cmd}">${label}</button>`).join("");
}

function drawScene() {
  frame += 1;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (mode === "title") return drawTitle();
  drawDungeon();
  drawMiniMap();
  if (mode === "battle") drawBattle();
  if (mode === "chest") drawChest();
  if (mode === "gameover") drawCentered("全滅", "#ff6666", 78);
}

function drawTitle() {
  if (titleImage.complete && titleImage.naturalWidth) {
    ctx.drawImage(titleImage, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(0,0,0,.52)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  // Star field
  for (let i = 0; i < 48; i++) {
    const sx = (i * 139 + frame * ((i % 3) + 1) * 0.25) % canvas.width;
    const sy = (i * 167) % 260;
    const bright = 0.25 + 0.45 * Math.sin(frame / 22 + i);
    ctx.fillStyle = `rgba(244,236,208,${bright.toFixed(2)})`;
    ctx.fillRect(Math.floor(sx), Math.floor(sy), 2, 2);
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "#d9b65f";
  ctx.font = "56px 'MS Gothic', monospace";
  ctx.fillText("サカムビット公の逆襲", 480, 230 + Math.sin(frame / 28) * 5);
  ctx.fillStyle = "#f4ecd0";
  ctx.font = "24px 'MS Gothic', monospace";
  ctx.fillText("WIZARDRY STYLE v3", 480, 284);
  if (Math.floor(frame / 32) % 2 === 0) {
    ctx.fillStyle = "#d9b65f";
    ctx.fillText("PRESS ENTER", 480, 430);
  }
}

function drawDungeon() {
  const W = canvas.width, H = canvas.height;
  const wc = floor().color;
  ctx.fillStyle = "#050403";
  ctx.fillRect(0, 0, W, H);
  if (_dark > 0) {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,100,20,0.10)"; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center"; ctx.fillStyle = "#553300";
    ctx.font = "bold 28px 'MS Gothic', monospace";
    ctx.fillText("― 暗 闇 ―", W / 2, H / 2);
    ctx.font = "16px 'MS Gothic', monospace";
    ctx.fillStyle = "#442200";
    ctx.fillText(`残り ${_dark} 歩`, W / 2, H / 2 + 36);
    // compass still visible
    const DN = ["北","東","南","西"];
    const li = (state.dir + 3) % 4, ri = (state.dir + 1) % 4;
    const bcx = W / 2, bcy = H - 20;
    ctx.fillStyle = "rgba(0,0,0,0.82)"; ctx.fillRect(bcx - 162, bcy - 26, 324, 34);
    ctx.strokeStyle = rgba(wc, 0.55); ctx.lineWidth = 1;
    ctx.strokeRect(bcx - 162, bcy - 26, 324, 34);
    ctx.font = "17px 'MS Gothic', monospace"; ctx.fillStyle = rgba(wc, 0.72); ctx.textAlign = "left";
    ctx.fillText("◄ " + DN[li], bcx - 154, bcy - 1);
    ctx.font = "bold 19px 'MS Gothic', monospace"; ctx.fillStyle = "#ff6666"; ctx.textAlign = "center";
    ctx.fillText("↑ " + DN[state.dir], bcx, bcy - 1);
    ctx.font = "17px 'MS Gothic', monospace"; ctx.fillStyle = rgba(wc, 0.72); ctx.textAlign = "right";
    ctx.fillText(DN[ri] + " ►", bcx + 154, bcy - 1);
    return;
  }
  // Ceiling with perspective grid
  const ceilGrad = ctx.createLinearGradient(0, 0, 0, 120);
  ceilGrad.addColorStop(0, "#090707");
  ceilGrad.addColorStop(1, "#1a1210");
  ctx.fillStyle = ceilGrad;
  ctx.fillRect(0, 0, W, 120);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, 120); ctx.clip();
  ctx.strokeStyle = rgba(wc, 0.04); ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 80) { ctx.beginPath(); ctx.moveTo(W / 2, 120); ctx.lineTo(x, 0); ctx.stroke(); }
  for (let z = 2; z < 22; z++) { const cy = 120 * (1 - 1 / z); ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke(); }
  ctx.restore();
  // Floor with perspective grid
  const floorGrad = ctx.createLinearGradient(0, 470, 0, H);
  floorGrad.addColorStop(0, "#141008");
  floorGrad.addColorStop(1, "#060504");
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, 470, W, H - 470);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 470, W, H - 470); ctx.clip();
  ctx.strokeStyle = rgba(wc, 0.055); ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 80) { ctx.beginPath(); ctx.moveTo(W / 2, 470); ctx.lineTo(x, H); ctx.stroke(); }
  for (let z = 2; z < 22; z++) { const fy = 470 + 170 / z; ctx.beginPath(); ctx.moveTo(0, fy); ctx.lineTo(W, fy); ctx.stroke(); }
  ctx.restore();
  const fwd = DIRS[state.dir];
  const rgt = { dx: -fwd.dy, dy: fwd.dx };
  const lft = { dx: fwd.dy, dy: -fwd.dx };
  const view = [];
  for (let d = 0; d < 5; d++) {
    const x = state.x + fwd.dx * d;
    const y = state.y + fwd.dy * d;
    view.push({
      front: tileAt(x + fwd.dx, y + fwd.dy) === "#",
      left: tileAt(x + lft.dx, y + lft.dy) === "#",
      right: tileAt(x + rgt.dx, y + rgt.dy) === "#"
    });
  }
  const leftWall  = ["#3c3028","#2e2620","#24201a","#1c1814"];
  const rightWall = ["#4a3c30","#3a302a","#2e2622","#221e1a"];
  for (let d = 3; d >= 0; d--) {
    const a = slice(d), b = slice(d + 1), alpha = 1 - d * .13;
    if (view[d].front) {
      ctx.fillStyle = ["#41372d","#342c24","#28221c","#1b1712"][d];
      ctx.fillRect(b.l, b.t, b.r - b.l, b.b - b.t);
      brick(b.l, b.t, b.r - b.l, b.b - b.t, d);
      ctx.strokeStyle = rgba(wc, alpha);
      ctx.lineWidth = 2;
      ctx.strokeRect(b.l, b.t, b.r - b.l, b.b - b.t);
    }
    sideWall(view[d].left,  a.l, a.t, b.l, b.t, b.l, b.b, a.l, a.b, leftWall[d],  rgba(wc, alpha * .75));
    sideWall(view[d].right, a.r, a.t, b.r, b.t, b.r, b.b, a.r, a.b, rightWall[d], rgba(wc, alpha * .75));
    ctx.strokeStyle = rgba(wc, alpha * .38);
    ctx.beginPath(); ctx.moveTo(b.l, b.t); ctx.lineTo(b.r, b.t); ctx.moveTo(b.l, b.b); ctx.lineTo(b.r, b.b); ctx.stroke();
  }
  drawTileHint();
  // コンパス（底部中央）
  const DN = ["北","東","南","西"];
  const li = (state.dir + 3) % 4, ri = (state.dir + 1) % 4;
  const bcx = W / 2, bcy = H - 20;
  ctx.fillStyle = "rgba(0,0,0,0.82)";
  ctx.fillRect(bcx - 162, bcy - 26, 324, 34);
  ctx.strokeStyle = rgba(wc, 0.55); ctx.lineWidth = 1;
  ctx.strokeRect(bcx - 162, bcy - 26, 324, 34);
  ctx.font = "17px 'MS Gothic', monospace";
  ctx.fillStyle = rgba(wc, 0.72); ctx.textAlign = "left";
  ctx.fillText("◄ " + DN[li], bcx - 154, bcy - 1);
  ctx.font = "bold 19px 'MS Gothic', monospace";
  ctx.fillStyle = "#ff6666"; ctx.textAlign = "center";
  ctx.fillText("↑ " + DN[state.dir], bcx, bcy - 1);
  ctx.font = "17px 'MS Gothic', monospace";
  ctx.fillStyle = rgba(wc, 0.72); ctx.textAlign = "right";
  ctx.fillText(DN[ri] + " ►", bcx + 154, bcy - 1);
  // Torch flicker — warm radial gradient pulsing at center (torch always in ROM)
  const flicker = 0.04 + 0.015 * Math.sin(frame / 19) + 0.008 * Math.sin(frame / 7);
  const tg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.58);
  tg.addColorStop(0, `rgba(255,170,60,${flicker})`);
  tg.addColorStop(0.45, `rgba(255,100,20,${flicker * 0.3})`);
  tg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H);
  // Edge vignette (always)
  const vg = ctx.createRadialGradient(W / 2, H / 2, W * 0.28, W / 2, H / 2, W * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // Danger vignette (red when danger > 55)
  if (state.danger > 55) {
    const da = Math.min(0.28, (state.danger - 55) / 240);
    const dg = ctx.createRadialGradient(W / 2, H / 2, W * 0.22, W / 2, H / 2, W * 0.65);
    dg.addColorStop(0, 'rgba(0,0,0,0)');
    dg.addColorStop(1, `rgba(160,0,0,${da})`);
    ctx.fillStyle = dg; ctx.fillRect(0, 0, W, H);
  }
  // 外枠 & 階名（左上）
  ctx.strokeStyle = rgba(wc, .7); ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, W - 4, H - 4);
  ctx.fillStyle = wc; ctx.textAlign = "left";
  ctx.font = "16px 'MS Gothic', monospace";
  ctx.fillText(floor().name, 14, 20);
}

function slice(d) {
  const s = [
    { l: 0, r: 960, t: 0, b: 640 },
    { l: 180, r: 780, t: 100, b: 500 },
    { l: 312, r: 648, t: 183, b: 417 },
    { l: 402, r: 558, t: 237, b: 363 },
    { l: 449, r: 511, t: 267, b: 333 }
  ];
  return s[Math.min(d, s.length - 1)];
}

function brick(x, y, w, h, d) {
  if (w < 4 || h < 4) return;
  const rows = Math.max(2, 5 - d);
  const cols = Math.max(2, 4 - d);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.strokeStyle = "rgba(0,0,0,.40)";
  // Horizontal mortar lines
  for (let r = 1; r < rows; r++) {
    const yy = Math.floor(y + h * r / rows);
    ctx.moveTo(x, yy); ctx.lineTo(x + w, yy);
  }
  // Vertical mortar lines — staggered per row (matches FC brick tile pattern)
  for (let r = 0; r < rows; r++) {
    const rowTop = y + h * r / rows;
    const rowBot = y + h * (r + 1) / rows;
    const off = (r % 2) * 0.5;
    for (let c = 1; c < cols + 1; c++) {
      const xx = Math.floor(x + w * (c - off) / cols);
      if (xx > x && xx < x + w) { ctx.moveTo(xx, rowTop); ctx.lineTo(xx, rowBot); }
    }
  }
  ctx.stroke();
  // Subtle top-edge highlight per brick row
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,.05)";
  for (let r = 0; r < rows; r++) {
    const yy = Math.floor(y + h * r / rows) + 1;
    ctx.moveTo(x + 2, yy); ctx.lineTo(x + w - 2, yy);
  }
  ctx.stroke();
}

function sideWall(on, x1, y1, x2, y2, x3, y3, x4, y4, fill, stroke) {
  if (on) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4);
    ctx.closePath(); ctx.fill();
    // Inner-edge shadow strip for depth (near edge = x1 side)
    const shadowW = Math.max(2, Math.abs(x1 - x2) * 0.12);
    const grad = ctx.createLinearGradient(x1, 0, x1 + (x2 > x1 ? shadowW : -shadowW), 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.30)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4);
    ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = on ? 2 : 1;
  ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x3, y3); ctx.stroke();
}

function drawTileHint() {
  const labels = { T: "宝箱", K: "鍵", B: "玉座", E: "碑文", D: "罠", "<": "上り階段", ">": "下り階段" };
  const label = labels[tileAt(state.x, state.y)];
  if (!label) return;
  ctx.fillStyle = "rgba(0,0,0,.75)";
  ctx.fillRect(390, 108, 180, 38);
  ctx.strokeStyle = "#d9b65f";
  ctx.strokeRect(390, 108, 180, 38);
  ctx.fillStyle = "#d9b65f";
  ctx.textAlign = "center";
  ctx.font = "20px 'MS Gothic', monospace";
  ctx.fillText(label, 480, 133);
}

function drawMiniMap() {
  const f = floor();
  const seen = state.seen[`f${state.floor}`] || {};
  const size = 9, ox = 960 - f.map[0].length * size - 18, oy = 640 - f.map.length * size - 18;
  ctx.fillStyle = "rgba(0,0,0,.8)";
  ctx.fillRect(ox - 7, oy - 7, f.map[0].length * size + 14, f.map.length * size + 14);
  for (let y = 0; y < f.map.length; y++) for (let x = 0; x < f.map[y].length; x++) {
    if (!seen[`${x},${y}`]) continue;
    ctx.fillStyle = tileAt(x, y, f) === "#" ? "#333" : "#17351f";
    ctx.fillRect(ox + x * size, oy + y * size, size - 1, size - 1);
  }
  ctx.fillStyle = "#ff6666";
  ctx.fillRect(ox + state.x * size + 1, oy + state.y * size + 1, size - 2, size - 2);
}

function drawBattle() {
  const enemies = liveEnemies();
  const isBoss = battle.id === "boss";
  const pulse = isBoss ? 0.06 * Math.sin(frame / 16) : 0;
  ctx.fillStyle = isBoss ? `rgba(35,0,0,${0.87 + pulse})` : "rgba(0,0,0,0.85)";
  ctx.fillRect(260, 148, 440, 304);
  ctx.strokeStyle = isBoss ? "#ff6666" : "#d9b65f";
  ctx.lineWidth = isBoss ? 2 + Math.abs(Math.sin(frame / 14)) : 2;
  ctx.strokeRect(260, 148, 440, 304);
  ctx.textAlign = "center";
  ctx.fillStyle = isBoss ? "#ff6666" : "#f4ecd0";
  ctx.font = (isBoss ? "bold " : "") + "26px 'MS Gothic', monospace";
  ctx.fillText(enemies[0]?.name || "敵", 480, 192);
  const sprY = 286 + Math.round(Math.sin(frame / 38) * 2);
  drawMonsterGlyph(battle.id, 480, sprY);
  // Hit flash
  if (_hitFlash > 0) {
    ctx.globalAlpha = _hitFlash * 0.55;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(380, 215, 200, 118);
    ctx.globalAlpha = 1;
    _hitFlash = Math.max(0, _hitFlash - 0.14);
  }
  // HP bar
  const e = enemies[0];
  if (e) {
    const ratio = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = "#111";
    ctx.fillRect(338, 362, 284, 14);
    ctx.fillStyle = ratio < 0.3 ? "#ff5f5f" : ratio < 0.6 ? "#ffcf66" : "#58ff9a";
    ctx.fillRect(338, 362, Math.round(284 * ratio), 14);
    ctx.strokeStyle = "#444"; ctx.lineWidth = 1;
    ctx.strokeRect(338, 362, 284, 14);
    ctx.fillStyle = "#aaa";
    ctx.font = "13px 'MS Gothic', monospace";
    ctx.fillText(`HP ${e.hp}/${e.maxHp}`, 480, 388);
  }
  // Enemy count dots
  const cnt = enemies.length;
  if (cnt > 1) {
    const sp = Math.min(18, 140 / cnt);
    const sx = 480 - (cnt - 1) * sp / 2;
    for (let i = 0; i < cnt; i++) {
      ctx.beginPath(); ctx.arc(sx + i * sp, 408, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#58ff9a"; ctx.fill();
    }
  }
  ctx.font = "16px 'MS Gothic', monospace";
  ctx.fillStyle = "#888";
  ctx.fillText(`残り ${cnt}体  ROUND ${battle.round}`, 480, cnt > 1 ? 430 : 415);
}

// Shared 24×24 pixel bodies (palette indices, '.' = transparent)
const _D = {
  skeleton: [
    "..........4444..........",
    "........44111144........",
    ".......4112112214.......",
    ".......4121111214.......",
    ".......4145114514.......",
    ".......4115115114.......",
    ".......4411411144.......",
    "........41444414........",
    ".........441144.........",
    "........44111144........",
    ".......4112312214.......",
    "......41131113121.4.....",
    ".....411313131311447....",
    "....41131313131314477...",
    "....41311313131314477...",
    ".....4111313131114447...",
    "......44131311144.47....",
    "........4131134...4.....",
    ".......41131134.........",
    "......4131113134........",
    "......4111441114........",
    ".......4444..4444.......",
    "........................",
    "........................",
  ],
  kobold: [
    "........................",
    "........................",
    "........4444............",
    ".....444121144..........",
    "....4112221221.4........",
    "...41122122122144.......",
    "...41212222122214.......",
    "...4145222222145.4......",
    "...4112222222211.4......",
    "...41122244222214.......",
    "....411111441111.4......",
    ".....44113113114........",
    "....46411111111464......",
    "...4661412112146614.....",
    "...46641121121466614....",
    "...4146411111146641.....",
    "....414411331141144.....",
    "....414.4111114.4.4.....",
    "....44..411111.4........",
    "........41331134........",
    ".......4131..1314.......",
    "......4111....1114......",
    ".......44......44.......",
    "........................",
  ],
  rat: [
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    ".....44.......4444......",
    "....4114.....411114.....",
    "....414114..41122114....",
    "....4112114.41212114....",
    "...411221141121121.4....",
    "...41112221111212144....",
    "..411512215111212114....",
    ".4112212211121121144....",
    "411222221112121211464...",
    "412222221112212121144...",
    "41122221112121212114....",
    ".411221111212121214.....",
    "..4111443333333333144...",
    "...44.4111111111111144..",
    "..........44444444444...",
    "........................",
    "........................",
    "........................",
    "........................",
  ],
  brigand: [
    "..........4444..........",
    ".........455554.........",
    "........45555554........",
    ".......4555555554.......",
    ".......4112221114.......",
    "......411222112114......",
    "......412112112214......",
    "......412141241214......",
    "......412141241214......",
    "......411221122114......",
    "......41124444211.4.....",
    ".......4112112144.4.....",
    "........44111441..4.....",
    "........48888884..4.....",
    "......448888888.4.4.....",
    ".....488188888881477....",
    "....4881118881111477....",
    "....4811881411184477....",
    "....4811881441844474....",
    "....4881144111844474....",
    ".....411..4848.444.4....",
    "......4...44.44...44....",
    "........................",
    "........................",
  ],
  gargoyle: [
    "........................",
    "...4..............4.....",
    "..414............414....",
    "..4214..........4124....",
    ".42114..........41124...",
    ".4221.4........4.1224...",
    "421121.4......4.121124..",
    "4222111.4....4.1112224..",
    "4222121144444411212224..",
    "42221121221122112122224.",
    "42221122122122122112224.",
    "4222115221122115122224..",
    ".42221212222221212224...",
    ".422211224442211222244..",
    "..422111111111111224.4..",
    "..4422211221122114.4....",
    "....4421111111144.4.....",
    ".4...44441111144.4......",
    "44....441211214.4.......",
    "414...44111111.4........",
    "4214..4112233214........",
    "42214.41122332214.......",
    ".42214411222311114......",
    "..44444411111111144.....",
  ],
  wisp: [
    "........................",
    "........................",
    "..3.....3....3....3..3..",
    "..13...13...31...13.31..",
    "..13...13.4413..313.31..",
    "...13.13441132.13.131...",
    "...131134222113313131...",
    "....1342222255211131....",
    "....34222255555221111...",
    "...3422255555552223113..",
    "..342225555555255222113.",
    ".3422255555555525522231.",
    ".34222555552555525522231",
    "3422255555555555525522.3",
    "342225555555555552522.13",
    ".4222555555555555252231.",
    ".42225555555555552223.31",
    "..4222555525555525223.13",
    "...422225555555522231...",
    "....4222255555522231....",
    "...31.42222222231..3....",
    "...13..4422244...3..3...",
    "..3...3.3.3.3...3..3....",
    "...3...3...3..3..3..3...",
  ],
  moth: [
    "........................",
    "........................",
    ".4444........4......444.",
    "412224.....4414....42224",
    "4122224...414314..422224",
    "412222244133331414222214",
    "41222213355555314222214.",
    ".412223335555533142214..",
    "..41222555555552122214..",
    "...4122555555555212214..",
    ".4..42225555555555121.4.",
    "44...41225555555521214..",
    "414...4122224444221.4...",
    "4214....41223322221.4...",
    "42214....4112222214.....",
    ".4421....411611611.4....",
    "...441...4122222214.....",
    ".....4...4122222214.....",
    ".........411222214......",
    "..........41122214......",
    "...........4122214......",
    "............411114......",
    ".............4444.......",
    "........................",
  ],
  golem: [
    "........................",
    ".........4444...........",
    "........411114..........",
    ".......41122114.........",
    ".......4112221.4........",
    ".......4155215.4........",
    ".......4112221.4........",
    "........4133314.........",
    ".....444411111444.......",
    "....411111122211114.....",
    "...411222112221112214...",
    "..41122221122122112214..",
    "..41212221122122112224..",
    "..41121121121211221124..",
    "..41122112112112212124..",
    "..41112112233211221224..",
    "..41122113311221122224..",
    "...4111443333344111244..",
    "....44441111133344112244",
    "........4111144441112244",
    "........4112214..4111244",
    "........4112214..44441.4",
    "........411331.4....4444",
    ".........44444..........",
  ],
  minotaur: [
    "........................",
    "........................",
    "...4..............4.....",
    "..414............414....",
    "..4154..........4514....",
    "..41214........41214....",
    "...41244......44214.....",
    "....412211223112214.....",
    "....411222222221.144....",
    ".....412221122214.456...",
    ".....4115554555.4.456...",
    "......41122221.4..456...",
    "......41147741444.456...",
    "......4111111114..456...",
    ".....411222111214.456...",
    "....412122212211.4456...",
    "...4112212222112144565..",
    "..41122221122212211456..",
    "..41122112212221221456..",
    "..41112212212212212456..",
    "...44411221122122174556.",
    ".....4441111111111456...",
    "........44114444444555..",
    "..........4444....44....",
  ],
  warden: [
    "........................",
    "........4444............",
    ".......411114...........",
    ".......4122114..........",
    "......41222214..........",
    "......41155514..........",
    "......41115114..........",
    "......41555514..........",
    ".......4111114..........",
    "......41444414..........",
    ".....411111111144.......",
    "....41122112211114......",
    "....41122112211114......",
    "....41121441211114......",
    "....41112112111114......",
    "....41122222221114......",
    "....41122112211114......",
    "....41112112111114......",
    "....41122222221114......",
    "....41112221112114......",
    "....41121441121114......",
    "....41121441121114......",
    ".....4441444144114......",
    ".....4..4444....44......",
  ],
  shade: [
    "........................",
    "........................",
    "..........4444..........",
    ".........411114.........",
    "........4111111.4.......",
    ".......41111121.4.......",
    "......411122231114......",
    ".....4112333231114......",
    "....411233355331314.....",
    "....412333555533334.....",
    "....412233555533334.....",
    "....411233355333114.....",
    "...4112233333331114.....",
    "...4112333333331114.....",
    "...4112333333311114.....",
    "..41122333333331114.....",
    "..41123333333331114.....",
    "..41123333333333114.....",
    ".411233333333333114.....",
    ".411333333333333114.....",
    ".411333333333333314.....",
    ".411333333333333334.....",
    "..4441333333333334......",
    ".....44111111114444.....",
  ],
  hound: [
    "........................",
    "........................",
    "........................",
    "........................",
    ".......44...............",
    "......4114..............",
    ".....412114.............",
    ".....412211....4444.....",
    "....411222.444112214....",
    "....412125555111121.4...",
    "...4112225555212121.4...",
    "...41122212111121121.4..",
    "..4112216611216662214...",
    "..4111226611112116224...",
    "..4111121166622112224...",
    "..4112221122222122214...",
    "...4111221221221221.4...",
    "....4444443443344444....",
    "........4111114.........",
    "........4111114.........",
    ".........4444...........",
    "........................",
    "........................",
    "........................",
  ],
  dragon: [
    "........................",
    "...4..................4.",
    "..414................414",
    ".41214..............4124",
    ".4122144...........41124",
    ".42221124.........412124",
    ".42221224........4122124",
    ".42222124.......41221124",
    ".42221224.......4122214.",
    "..4222214444444412221.4.",
    "..422222122122122222.4..",
    "...4222112221122122214..",
    "....4221221112212222214.",
    ".....4111122112222222214",
    ".....411411111441222214.",
    "....411513411335122214..",
    "...41122225555512221.4..",
    "...4112266677766122.4...",
    "....441444444444112144..",
    "......4444....414112144.",
    "..........4...4444411144",
    "..........44........4444",
    "........................",
    "........................",
  ],
  banshee: [
    "........................",
    "..........4444..........",
    ".........411114.........",
    "........41311134........",
    ".......4131111314.......",
    "......413112211134......",
    "......413122222134......",
    "......413122222134......",
    "......41314554134.4.....",
    "......41312112134.4.....",
    ".....4131322223134.4....",
    "....4131322333213134....",
    "....413132223332131.4...",
    "...41311111111111114....",
    "...4131322222232131.4...",
    "...4131333333333131.4...",
    "...4131322222232131.4...",
    "...4133333333333331.4...",
    "...4131322222232131.4...",
    "...4131333333333131.4...",
    "...4133333333333331.4...",
    "...4133313331313331.4...",
    "....441341434343414.....",
    "......4..4..4..44.4.....",
  ],
  lich: [
    "..........4444..........",
    ".........455554.........",
    "........45555554........",
    ".......4555555554.......",
    ".......4566666654.......",
    "........4566664.........",
    ".4........4444..........",
    "414.....4411114.........",
    "4664...4112222114.......",
    ".4664.41122222211.4.....",
    ".46641412221122214.4....",
    "..4664112221122114.4....",
    "..46641122222222114.4...",
    "...46411122222221114.4..",
    "...46411122112221114.4..",
    "....46411122222111144.4.",
    "....46411112222111114.4.",
    ".....4641111122211114.4.",
    ".....46411111111111114..",
    "......464411122211114...",
    "......46.4411221114.....",
    ".......4...4441144......",
    "...........4..44........",
    "........................",
  ],
  mimic: [
    "........................",
    "........................",
    "........................",
    "...44444444444444444....",
    "..4112112112112121214...",
    "..4121211211212121214...",
    "..4112112112112112214...",
    "..4111111511511111114...",
    "..4111552555525551114...",
    "..47.7.7.7.7.7.7.7.74...",
    "..4767676767676767674...",
    "..4666666666666666664...",
    "..4666665566655666664...",
    "..4666566666666656664...",
    "..4767676767676767674...",
    "..47.7.7.7.7.7.7.7.74...",
    "..4112112112112112214...",
    "..4121144114411441214...",
    "..4112144114411441124...",
    "..4111144114411441114...",
    "..4112144114411441214...",
    "..4111111111111111114...",
    "..4444444444444444444...",
    "........................",
  ],
  angel: [
    "..........5555..........",
    ".........5544455........",
    ".........5.44.55........",
    "..........4444..........",
    ".........411114.........",
    "........41122114........",
    "........41212214........",
    "........41112114........",
    "........41122114........",
    ".22.....4112221.4..2....",
    ".112...41122222.4.121...",
    "1112...4111441114.211...",
    "12122..421144114224121..",
    "21122144211441142244221.",
    "21221124111111111121221.",
    "12211142112112212111212.",
    "12122..422112212224121..",
    "1112...41122222211.211..",
    ".112...41122332214221...",
    ".22....41122332211.4....",
    ".......41112332111.4....",
    "........4441111144......",
    "...........44...........",
    "........................",
  ],
  mirror: [
    "........................",
    "..........4444..........",
    ".........411114.........",
    "........41122114........",
    "........41212214........",
    "........41122114........",
    "........41121214........",
    "........41122114........",
    "........41444414........",
    "......44.411114.44......",
    ".....411111111111144....",
    ".....411222112221124....",
    "....4112225112221224....",
    "....4112221112212224....",
    "....4112212212221224....",
    ".....4112222221122144...",
    "......4112212212211.4...",
    "......41122112221.4.....",
    "......4111111111144.....",
    "......4112211221124.....",
    "......41121121121.4.....",
    "......41122112224.4.....",
    "......4441111144.4......",
    ".......4..4444...4......",
  ],
  guardian: [
    "..........4444..........",
    ".........412214.........",
    "........41122214........",
    "........41277214........",
    "........41212214........",
    "........41122214........",
    ".........4111114........",
    "........44211224........",
    ".......4112222114.......",
    ".......41121121144.5....",
    "......4112222122.4.55...",
    ".....411221122222.4555..",
    "....4112212222112214555.",
    "...41122122222112221455.",
    "..411221221122122212.55.",
    "..41122122212212222145..",
    "...4112212222122112144..",
    "....411222112221221.44..",
    "....41112222122112144...",
    ".....41121221221.444....",
    ".....4111221121144......",
    "......4441111114........",
    "........4111114.........",
    ".........44444..........",
  ],
  oracle: [
    "........................",
    "..........4444..........",
    ".........455554.........",
    "........45555554........",
    ".......4555555554.......",
    "........4566664.........",
    "........41666614........",
    "........47666674........",
    ".4.....411111111.4......",
    "414...41122222211.4.....",
    "414...41122222221.4.....",
    "414...41122122122.4.....",
    "414..4112221121221.4....",
    "414..4112212221121.4....",
    "414..4112221122122.4....",
    "414..4112212211221.4....",
    "414..4112221122122.4....",
    "414..4112222221221.4....",
    "414..4112222122212.4....",
    "414..4112112212222.4....",
    "414..4112221122112.4....",
    "414..4112212221112.4....",
    "414...44411111114.4.....",
    "4554....44444444........",
  ],
  boss: [
    "..........4444..........",
    ".........455554.........",
    "........45555554........",
    ".......4555555554.......",
    ".......4111111114.......",
    ".......4188888814.......",
    ".......4188118814.......",
    ".......4118888114.......",
    "........41888814........",
    "........41444414........",
    ".......41122221.4.......",
    ".5....411222122114......",
    ".55..41122212221114.....",
    "555.4112221112221124....",
    ".55411221225221221124...",
    ".5541221221222122112144.",
    "..41122122122122112214.4",
    "..41122212221122122114.4",
    "...4112212221122122144..",
    "....411222122112212144..",
    ".....4112212221122144...",
    "......41122122212144....",
    ".......41112222144......",
    "........4441444.........",
  ],
};

const SPRITES = {
  // --- 21 originals ---
  skeleton:    { p:[0,'#e8e0c8','#fff8e0','#989078','#201810','#ff5020','#888070','#c0a830'], d:_D.skeleton },
  kobold:      { p:[0,'#5a8030','#88b048','#3a5820','#201810','#c02020','#806040'], d:_D.kobold },
  rat:         { p:[0,'#7a5030','#a87048','#502810','#201810','#ff2020','#f0c8a0'], d:_D.rat },
  brigand:     { p:[0,'#c89878','#e8b898','#806048','#201810','#583820','#888888','#c0c0c0','#a05030'], d:_D.brigand },
  gargoyle:    { p:[0,'#807868','#a89888','#504838','#201810','#ff8000'], d:_D.gargoyle },
  wisp:        { p:[0,'#a040c0','#e080ff','#601890','#201810','#ffe0ff'], d:_D.wisp },
  moth:        { p:[0,'#9870a0','#c098c8','#604070','#201810','#e0c8e0','#a04020'], d:_D.moth },
  golem:       { p:[0,'#a87040','#c89860','#704020','#201810','#ffc040'], d:_D.golem },
  minotaur:    { p:[0,'#604030','#906040','#301808','#201810','#a8a8b0','#d0d0d8','#ff5020','#604020'], d:_D.minotaur },
  warden:      { p:[0,'#7080a0','#a0b0d0','#404858','#201810','#e8c890','#806040','#c0a070'], d:_D.warden },
  shade:       { p:[0,'#303050','#505070','#181828','#201810','#ff20ff','#9080a0','#604070'], d:_D.shade },
  hound:       { p:[0,'#202028','#404048','#0a0a10','#201810','#ff2020','#fff0e0'], d:_D.hound },
  dragon:      { p:[0,'#406030','#608848','#203818','#201810','#ffe040','#c8a020','#ff6020'], d:_D.dragon },
  banshee:     { p:[0,'#d8d0e8','#f0e8ff','#706080','#201810','#4060a0','#90a0d0'], d:_D.banshee },
  lich:        { p:[0,'#504080','#8060c0','#281840','#201810','#e8e0c8','#ff20ff','#ffe040'], d:_D.lich },
  mimic:       { p:[0,'#806040','#a88060','#503020','#201810','#ffe080','#c83030','#ffffff'], d:_D.mimic },
  angel:       { p:[0,'#f0f0f8','#ffffff','#a8a8c0','#201810','#ffe040','#80a0c0','#c8c8d0'], d:_D.angel },
  mirror:      { p:[0,'#4080c0','#80c0f0','#204080','#201810','#ffffff','#c0e0ff'], d:_D.mirror },
  guardian:    { p:[0,'#c8a040','#ffd860','#806020','#201810','#e8e8e8','#a0a0a8','#ff2020'], d:_D.guardian },
  oracle:      { p:[0,'#604898','#9078c0','#302060','#201810','#ffe040','#e8d0a0','#80c0ff'], d:_D.oracle },
  boss:        { p:[0,'#d0d0e0','#ffffff','#707080','#201810','#ffe040','#c8a020','#ff2040','#604020'], d:_D.boss },
  // --- B1F new ---
  goblin:       { p:[0,'#3a6018','#5a9028','#1a3008','#201810','#a01010'], d:_D.kobold },
  zombie:       { p:[0,'#607050','#809068','#283018','#201810','#40a020','#805030'], d:_D.skeleton },
  cave_bat:     { p:[0,'#504858','#706870','#282030','#201810','#e04040'], d:_D.moth },
  slime:        { p:[0,'#408040','#60c060','#204020','#201810','#c0ffc0'], d:_D.wisp },
  cave_spider:  { p:[0,'#301818','#502828','#180808','#201810','#e04040'], d:_D.gargoyle },
  imp:          { p:[0,'#803028','#c04840','#401008','#201810','#ff8000'], d:_D.kobold },
  bandit:       { p:[0,'#704838','#906858','#382018','#201810','#403020','#707070','#a0a0a0','#784030'], d:_D.brigand },
  mushroom_man: { p:[0,'#906850','#b09070','#503820','#201810','#e08080'], d:_D.golem },
  toad:         { p:[0,'#406030','#608050','#202808','#201810','#c0e040'], d:_D.rat },
  mud_bat:      { p:[0,'#604830','#887060','#302010','#201810','#a08040'], d:_D.moth },
  bone_dog:     { p:[0,'#d8d0b8','#f0e8d0','#908878','#201810','#e04040'], d:_D.hound },
  plague_rat:   { p:[0,'#6a7030','#9aaa48','#303808','#201810','#c0e020'], d:_D.rat },
  thug:         { p:[0,'#503028','#704840','#281008','#201810','#303020','#606060','#909090','#603020'], d:_D.brigand },
  hollow:       { p:[0,'#484858','#686878','#202030','#201810','#8080d0','#a090b0'], d:_D.shade },
  rust_sprite:  { p:[0,'#904820','#c07040','#502010','#201810','#ffc060'], d:_D.wisp },
  cave_worm:    { p:[0,'#a07850','#c89870','#605030','#201810','#e0c080'], d:_D.golem },
  // --- B2F new ---
  fire_elemental: { p:[0,'#c04000','#ff8020','#801800','#201810','#ffff40'], d:_D.wisp },
  ice_sprite:     { p:[0,'#80b0e0','#c0e0ff','#406090','#201810','#ffffff'], d:_D.wisp },
  stone_snake:    { p:[0,'#787068','#a09888','#383028','#201810','#e04040'], d:_D.hound },
  bronze_scarab:  { p:[0,'#806820','#b09840','#403008','#201810','#e08000'], d:_D.gargoyle },
  crystal_fly:    { p:[0,'#80c0d0','#b0e8f0','#40787a','#201810','#ffffff'], d:_D.moth },
  hex_eye:        { p:[0,'#802080','#c040c0','#400040','#201810','#00ff80'], d:_D.wisp },
  venom_moth:     { p:[0,'#406020','#709040','#202808','#201810','#a0e020','#408030'], d:_D.moth },
  amber_golem:    { p:[0,'#c09030','#e0b858','#806010','#201810','#ffd060'], d:_D.golem },
  sand_wraith:    { p:[0,'#a89060','#d0b888','#604828','#201810','#e0d0a0','#b0a078'], d:_D.shade },
  cave_leech:     { p:[0,'#602020','#902838','#300808','#201810','#e02030'], d:_D.rat },
  rock_crab:      { p:[0,'#686058','#888070','#383028','#201810','#c08000'], d:_D.gargoyle },
  mold_creep:     { p:[0,'#508040','#78b060','#283818','#201810','#c0f080'], d:_D.golem },
  dust_devil:     { p:[0,'#c0a880','#e0c8a0','#807050','#201810','#fff0c0'], d:_D.wisp },
  toxic_ooze:     { p:[0,'#70a020','#a0e030','#385010','#201810','#d0ff20'], d:_D.wisp },
  brass_knight:   { p:[0,'#907020','#c0a040','#483808','#201810','#f0c850','#704820','#c09030'], d:_D.warden },
  jar_ghost:      { p:[0,'#a0c8d0','#c8e8f0','#507088','#201810','#40a0c0','#e0f8ff'], d:_D.banshee },
  swarm_bee:      { p:[0,'#c0a010','#f0d030','#604800','#201810','#101010','#603000'], d:_D.moth },
  chaos_sprite:   { p:[0,'#c040c0','#ff60ff','#601060','#201810','#ffff00'], d:_D.wisp },
  magma_slug:     { p:[0,'#902010','#d04020','#501008','#201810','#ff8020'], d:_D.rat },
  gloom_bat:      { p:[0,'#282038','#403060','#100818','#201810','#8060c0'], d:_D.moth },
  // --- B3F new ---
  dark_knight:  { p:[0,'#202028','#303040','#0a0a12','#201810','#8090a0','#505058','#607080'], d:_D.warden },
  bone_mage:    { p:[0,'#d8d0b0','#f8f0d0','#888070','#201810','#d8d0b0','#8040a0','#d080e0'], d:_D.lich },
  chain_ghost:  { p:[0,'#505868','#707880','#282e38','#201810','#60a0d0','#9090a8'], d:_D.shade },
  stone_troll:  { p:[0,'#686868','#909090','#303030','#201810','#a8a8a0','#d0d0d0','#808080'], d:_D.minotaur },
  cave_bear:    { p:[0,'#704830','#9a6848','#382010','#201810','#c08830','#a87040','#e09050'], d:_D.minotaur },
  wolf_shade:   { p:[0,'#303038','#484850','#181820','#201810','#c02020'], d:_D.hound },
  plague_doc:   { p:[0,'#384828','#587040','#182008','#201810','#a8d838','#60b000','#c8e000'], d:_D.lich },
  prison_guard: { p:[0,'#606870','#808880','#303038','#201810','#d0c870','#806040','#b09050'], d:_D.warden },
  iron_claw:    { p:[0,'#505858','#788090','#202828','#201810','#a0b0b8','#d0d8e0','#d03020'], d:_D.minotaur },
  mist_hag:     { p:[0,'#b0b8c0','#d0d8e0','#686878','#201810','#6080a0','#a0b8c8'], d:_D.banshee },
  eye_beast:    { p:[0,'#603878','#9058c0','#301838','#201810','#00ff80'], d:_D.wisp },
  shadow_dog:   { p:[0,'#181820','#282830','#080810','#201810','#800020'], d:_D.hound },
  dungeon_rat:  { p:[0,'#504848','#706868','#281818','#201810','#d04040'], d:_D.rat },
  rot_walker:   { p:[0,'#508040','#709860','#203820','#201810','#60c030','#806040','#a07050'], d:_D.skeleton },
  blood_moth:   { p:[0,'#801828','#c02030','#400808','#201810','#e03030','#601020'], d:_D.moth },
  tomb_bat:     { p:[0,'#403840','#605868','#201818','#201810','#a08090'], d:_D.moth },
  ruin_warden:  { p:[0,'#706050','#908070','#383020','#201810','#d0c080','#806040','#a08050'], d:_D.warden },
  hex_hand:     { p:[0,'#203838','#305050','#101820','#201810','#00e080','#80f0b0'], d:_D.shade },
  mud_troll:    { p:[0,'#604828','#887048','#302008','#201810','#a89060','#c8b080','#ff6020'], d:_D.minotaur },
  cave_horror:  { p:[0,'#181818','#282828','#080808','#201810','#e04040'], d:_D.gargoyle },
  // --- B4F new ---
  vampire:       { p:[0,'#181018','#282028','#0a080a','#201810','#a01018','#c0c0d0','#e04040'], d:_D.lich },
  wyvern:        { p:[0,'#302838','#504858','#181020','#201810','#ffe040','#c8a020','#e04020'], d:_D.dragon },
  basilisk:      { p:[0,'#304020','#507038','#141808','#201810','#e04040'], d:_D.hound },
  medusa:        { p:[0,'#508048','#78b068','#283820','#201810','#4060a0','#90a0d0'], d:_D.banshee },
  bone_lord:     { p:[0,'#e8e0c8','#fff8e0','#989078','#201810','#ffe040','#888070','#d0a030'], d:_D.skeleton },
  death_knight:  { p:[0,'#181020','#282030','#080810','#201810','#e8e8e8','#a0a0b0','#a00000'], d:_D.guardian },
  necromancer:   { p:[0,'#281838','#402858','#100818','#201810','#e8e0c8','#a030c0','#d080f0'], d:_D.lich },
  gold_golem:    { p:[0,'#c09020','#e0b840','#806000','#201810','#fff060'], d:_D.golem },
  chaos_knight:  { p:[0,'#382040','#583060','#181020','#201810','#e8e8e8','#a0a0b0','#ff40ff'], d:_D.guardian },
  shadow_dragon: { p:[0,'#1a1828','#2a2838','#0a0810','#201810','#8060a0','#c080e0','#6030a0'], d:_D.dragon },
  void_eye:      { p:[0,'#100818','#200c28','#080408','#201810','#4020e0'], d:_D.wisp },
  plague_knight: { p:[0,'#304820','#486838','#182008','#201810','#a0c840','#708030','#90b000'], d:_D.warden },
  flame_lich:    { p:[0,'#401000','#802000','#200800','#201810','#e8e0c8','#ff8020','#ffc040'], d:_D.lich },
  iron_golem:    { p:[0,'#585868','#787888','#282830','#201810','#e0e0f0'], d:_D.golem },
  rune_guardian: { p:[0,'#204870','#306898','#102038','#201810','#e8e8e8','#a0a0b0','#40a0ff'], d:_D.guardian },
  elder_mimic:   { p:[0,'#604020','#806040','#301808','#201810','#d0a040','#a03020','#ffffff'], d:_D.mimic },
  void_slime:    { p:[0,'#200830','#380858','#100218','#201810','#a040e0'], d:_D.wisp },
  cursed_armor:  { p:[0,'#302040','#483060','#181020','#201810','#e8e8e8','#a0a0b0','#a000a0'], d:_D.guardian },
  death_moth:    { p:[0,'#181020','#281830','#080810','#201810','#808080','#301840'], d:_D.moth },
  sin_eater:     { p:[0,'#400018','#680028','#200010','#201810','#c00040','#900030'], d:_D.shade },
  arch_wisp:     { p:[0,'#806020','#c09040','#402c00','#201810','#fff0a0'], d:_D.wisp },
  // --- B5F new ---
  fallen_angel:  { p:[0,'#282030','#403858','#100818','#201810','#a08000','#806010','#b8b8c8'], d:_D.angel },
  demon_lord:    { p:[0,'#600810','#981020','#300408','#201810','#a8a8b0','#d0d0d8','#ff2000'], d:_D.minotaur },
  void_dragon:   { p:[0,'#200828','#300c40','#100410','#201810','#a040d0','#7020a0','#e060ff'], d:_D.dragon },
  holy_knight:   { p:[0,'#e0e0f0','#ffffff','#909090','#201810','#e8e8e8','#f0f0a0','#c0c0ff'], d:_D.guardian },
  dark_oracle:   { p:[0,'#280840','#401060','#100020','#201810','#ffe040','#a880d0','#6040a0'], d:_D.oracle },
  soul_reaper:   { p:[0,'#101018','#201828','#080808','#201810','#60e0ff','#30a0d0'], d:_D.shade },
  divine_beast:  { p:[0,'#e8e8e0','#ffffff','#a8a880','#201810','#ffe060','#c0c0e0','#e8d880'], d:_D.angel },
  chaos_lord:    { p:[0,'#402030','#603050','#201018','#201810','#a8a8b0','#d0d0d8','#ff00ff'], d:_D.minotaur },
  archdemon:     { p:[0,'#200010','#400020','#0a0008','#201810','#a8a8b0','#d0d0d8','#800010'], d:_D.minotaur },
  storm_angel:   { p:[0,'#8090b0','#b0c0e0','#405068','#201810','#ffe040','#c0d0f0','#ffffff'], d:_D.angel },
  death_angel:   { p:[0,'#202028','#303040','#0a0a12','#201810','#a0a0b0','#606070','#c00020'], d:_D.angel },
  void_knight:   { p:[0,'#100818','#200c28','#080408','#201810','#d0d0e0','#a0a0b8','#6040e0'], d:_D.guardian },
  holy_golem:    { p:[0,'#d0d8e0','#f0f8ff','#808898','#201810','#ffe060'], d:_D.golem },
  curse_mage:    { p:[0,'#381028','#581840','#180a14','#201810','#e8e0c8','#d020c0','#f060e0'], d:_D.lich },
  doom_guardian: { p:[0,'#300810','#501020','#180408','#201810','#e8e8e8','#a0a0b0','#e02020'], d:_D.guardian },
  pale_rider:    { p:[0,'#d8d0c8','#f0e8e0','#888070','#201810','#60a0d0','#a0c0e0'], d:_D.shade },
  star_warden:   { p:[0,'#c0c8e0','#e0e8ff','#606880','#201810','#e8e8e8','#f8f8b0','#a0c0ff'], d:_D.guardian },
  abyss_eye:     { p:[0,'#080410','#100818','#040208','#201810','#2010a0'], d:_D.wisp },
  eternal_knight:{ p:[0,'#d0d0d8','#f0f0f8','#808088','#201810','#e8e8e8','#f0f0b0','#c0c0ff'], d:_D.guardian },
  sin_dragon:    { p:[0,'#601018','#901828','#300808','#201810','#ffe040','#c8a020','#ff4020'], d:_D.dragon },
  ruin_lord:     { p:[0,'#584030','#786050','#281808','#201810','#a8a0a8','#d0c8d0','#a05030'], d:_D.minotaur },
  dark_lord:     { p:[0,'#101018','#201828','#080808','#201810','#ffe040','#c8a020','#e02020','#201810'], d:_D.boss },
};

function drawSprite(id, cx, cy, ps) {
  const spr = SPRITES[id] || SPRITES.skeleton;
  const rows = spr.d, H = rows.length, W = rows[0].length;
  const ox = Math.round(cx - W * ps / 2), oy = Math.round(cy - H * ps / 2);
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const ch = rows[r][c];
      if (ch === "." || ch === "0") continue;
      const col = spr.p[parseInt(ch, 16)];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(ox + c * ps, oy + r * ps, ps, ps);
    }
  }
}

function drawMonsterGlyph(id, x, y) {
  drawSprite(id, x, y, 4);
}

function drawChest() {
  ctx.fillStyle = "rgba(0,0,0,.82)";
  ctx.fillRect(300, 160, 360, 280);
  ctx.strokeStyle = "#d9b65f"; ctx.lineWidth = 2;
  ctx.strokeRect(300, 160, 360, 280);
  // Pixel-art chest — scale 8px per "pixel"
  const ps = 8, ox = 360, oy = 200;
  const C = { wood: "#7a4b1e", lid: "#8b5e2a", band: "#b8960a", lock: "#d9b65f", dark: "#3d2008", shadow: "#1a0e04" };
  // Body (5×3 blocks)
  ctx.fillStyle = C.wood;   ctx.fillRect(ox, oy + ps*3, ps*10, ps*5);
  ctx.fillStyle = C.dark;   ctx.fillRect(ox, oy + ps*7, ps*10, ps);
  // Lid (5×2 blocks, slightly lighter)
  ctx.fillStyle = C.lid;    ctx.fillRect(ox, oy + ps,   ps*10, ps*3);
  ctx.fillStyle = C.shadow; ctx.fillRect(ox, oy + ps,   ps*10, 3);
  // Horizontal metal band (body)
  ctx.fillStyle = C.band;   ctx.fillRect(ox, oy + ps*5 - 3, ps*10, 6);
  // Horizontal metal band (lid)
  ctx.fillStyle = C.band;   ctx.fillRect(ox, oy + ps*3 - 3, ps*10, 6);
  // Left vertical band
  ctx.fillStyle = C.band;   ctx.fillRect(ox + ps*2, oy + ps, 5, ps*7);
  // Right vertical band
  ctx.fillStyle = C.band;   ctx.fillRect(ox + ps*8 - 5, oy + ps, 5, ps*7);
  // Lock (center)
  ctx.fillStyle = C.lock;   ctx.fillRect(ox + ps*4, oy + ps*3 - 6, ps*2, ps + 6);
  ctx.fillStyle = "#111";   ctx.beginPath(); ctx.arc(ox + ps*5, oy + ps*3 + 2, 5, 0, Math.PI * 2); ctx.fill();
  // Outline
  ctx.strokeStyle = "#5a3010"; ctx.lineWidth = 2;
  ctx.strokeRect(ox, oy + ps, ps*10, ps*7);
  ctx.strokeRect(ox, oy + ps, ps*10, ps*3);
  // Chest shadow beneath
  ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(ox + 6, oy + ps*8 + 2, ps*10 - 6, 8);
  // Status label
  ctx.textAlign = "center"; ctx.font = "20px 'MS Gothic', monospace";
  ctx.fillStyle = chest?.disarmed ? "#58ff9a" : chest?.inspected ? "#ffcf66" : "#aaa";
  ctx.fillText(chest?.disarmed ? "罠解除済み" : chest?.inspected ? "調査済み" : "未調査", 480, 395);
  if (chest?.trap && chest?.inspected && !chest?.disarmed) {
    ctx.fillStyle = "#ff6666";
    ctx.fillText("⚠ 罠あり", 480, 418);
  }
}

function drawCentered(text, color, size) {
  ctx.fillStyle = "rgba(0,0,0,.94)";
  ctx.fillRect(0, 0, 960, 640);
  // Red double border
  ctx.strokeStyle = "#550000"; ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 950, 630);
  ctx.strokeStyle = "#880000"; ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, 932, 612);
  // Faint red center glow
  const gr = ctx.createRadialGradient(480, 320, 0, 480, 320, 380);
  gr.addColorStop(0, 'rgba(100,0,0,0.18)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, 960, 640);
  // Main text
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px 'MS Gothic', monospace`;
  ctx.fillText(text, 480, 300);
  // GAME OVER line
  ctx.fillStyle = "#882222";
  ctx.font = "28px 'MS Gothic', monospace";
  ctx.fillText("― GAME OVER ―", 480, 370);
  ctx.fillStyle = "#553333";
  ctx.font = "18px 'MS Gothic', monospace";
  ctx.fillText("寺院に運ぶ者もいない", 480, 408);
}

function rgba(hex, a) {
  const n = hex.replace("#", "");
  return `rgba(${parseInt(n.slice(0,2),16)},${parseInt(n.slice(2,4),16)},${parseInt(n.slice(4,6),16)},${a})`;
}

function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

function command(cmd) {
  if (!cmd) return;
  if (cmd === "btn-a") {
    if (mode === "title")    return command("new");
    if (mode === "explore")  return command("inspect");
    if (mode === "battle")   return command("attack");
    if (mode === "chest")    return command("chestLoot");
    if (mode === "gameover") return command("new");
    return;
  }
  if (cmd === "btn-b") {
    if (mode === "title")    return command("load");
    if (mode === "explore")  return command("camp");
    if (mode === "battle")   return command("defend");
    if (mode === "chest")    return command("chestLeave");
    return;
  }
  if (cmd === "forward") move(1);
  if (cmd === "back") move(-1);
  if (cmd === "left") rotate(-1);
  if (cmd === "right") rotate(1);
  if (cmd === "inspect") inspect();
  if (cmd === "camp") showCamp();
  if (cmd === "map") showMap();
  if (cmd === "save") saveGame();
  if (cmd === "help") showHelp();
  if (cmd === "attack") playerRound("attack");
  if (cmd === "cast") playerRound("cast");
  if (cmd === "pray") playerRound("pray");
  if (cmd === "defend") playerRound("defend");
  if (cmd === "run") playerRound("run");
  if (cmd === "chestInspect") inspectChest();
  if (cmd === "chestDisarm") disarmChest();
  if (cmd === "chestLoot") lootChest();
  if (cmd === "chestLeave") { endBattle(); message = "宝箱を放置した。"; render(); }
  if (cmd?.startsWith("item:")) useItem(cmd.split(":")[1]);
  if (cmd === "new") { overlayEl.classList.remove("show"); newGame(); }
  if (cmd === "load") { overlayEl.classList.remove("show"); if (!loadGame()) { message = "保存データがない。"; render(); showTitle(); } }
}

commandsEl.addEventListener("click", e => command(e.target.closest("button")?.dataset.cmd));
touchEl.addEventListener("pointerdown", e => { const b = e.target.closest("button"); if (b) { e.preventDefault(); command(b.dataset.cmd); } });

overlayEl.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  const action = b.dataset.action;
  const buyId = b.dataset.buy;
  if (buyId) return buy(b.dataset.buyKind, buyId);
  if (action === "new") { overlayEl.classList.remove("show"); newGame(); }
  if (action === "load") { overlayEl.classList.remove("show"); if (!loadGame()) { message = "保存データがない。"; render(); showTitle(); } }
  if (action === "help") showHelp();
  if (action === "rest") rest();
  if (action === "temple") temple();
  if (action === "decurse") decurse();
  if (action === "transfer") showTransfer();
  if (action === "dotransfer") doTransfer(Number(b.dataset.member), b.dataset.cls);
  if (action === "equip") equipBest();
  if (action === "reorder") reorder();
  if (action === "save") saveGame();
  if (action === "status") showStatus();
  if (action === "close") { overlayEl.classList.remove("show"); render(); }
  if (action === "recruit") doRecruit();
  if (action === "skipRecruit") skipRecruit();
});

window.addEventListener("keydown", e => {
  if (e.isComposing || e.keyCode === 229) return;
  if (overlayEl.classList.contains("show") && e.key === "Escape") return closeModal();
  const dir = { ArrowUp: "forward", ArrowDown: "back", ArrowLeft: "left", ArrowRight: "right" };
  if (mode === "explore" && dir[e.key]) { e.preventDefault(); command(dir[e.key]); return; }
  const isA = e.key === "z" || e.key === "Z" || e.key === "Enter" || e.key === " ";
  const isB = e.key === "x" || e.key === "X" || e.key === "Escape";
  if (!isA && !isB) return;
  e.preventDefault();
  if (isA) command("btn-a");
  if (isB) command("btn-b");
});

function loop() {
  drawScene();
  requestAnimationFrame(loop);
}

titleImage.onload = () => { if (mode === "title") render(); };
state = { floor: 0, x: 1, y: 17, dir: 0, gold: 0, steps: 0, danger: 0, flags: {}, seen: {}, inventory: {}, stock: {}, party: partyTemplate.map(makeMember) };
message = "新しく始めるか、保存データを読み込んでください。";
render();
showTitle();
loop();
