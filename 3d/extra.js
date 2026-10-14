// 立体版だけの追加要素：レア装備・秘印・隠しボス・隠し階・称号・試練の間
// （通常版のデータは data.js、こちらは立体版で足した内容）

// ---- レア装備 ----
// tier 1=稀少（青） 2=秘宝（紫） 3=伝説（金）
// sp の意味：crit 会心率 / drain 与えた傷の一部を吸う / multi 追撃の確率 / spell 呪文の威力 / evade 敵の攻撃をかわす
//            thorns 受けた傷を返す / regen 歩くたび・手番ごとに回復 / ward 毒・麻痺・睡眠を防ぐ / luck 宝運 / first 先手 / boss 強敵への追加の傷
export const RARES = {
  boneKnife:    { name: "骨喰いの短刀",   type: "weapon",    atk: 9,  ac: 0,   tier: 1, sp: { crit: 0.08 }, desc: "骨まで届く細い刃。会心の一撃が出やすい。" },
  rustCleaver:  { name: "錆鉄の大鉈",     type: "weapon",    atk: 14, ac: 0,   tier: 1, sp: {}, desc: "重く鈍いが、振り下ろせば何でも割れる。" },
  ebonStaff:    { name: "黒檀の杖",       type: "weapon",    atk: 5,  ac: 0,   tier: 1, sp: { spell: 0.25 }, desc: "呪文の炎を一回り大きくする。" },
  vampRapier:   { name: "吸血公の細剣",   type: "weapon",    atk: 17, ac: 0,   tier: 2, sp: { drain: 0.25 }, desc: "斬った相手の命を、持ち主へ流し込む。" },
  twinAxe:      { name: "双頭の斧",       type: "weapon",    atk: 20, ac: 0,   tier: 2, sp: { multi: 0.3 }, desc: "返す刃でもう一撃が入る。" },
  starSword:    { name: "星鉄の長剣",     type: "weapon",    atk: 23, ac: -1,  tier: 2, sp: { crit: 0.12 }, desc: "落ちた星から鍛えた刃。" },
  sageAsh:      { name: "賢者の灰杖",     type: "weapon",    atk: 10, ac: 0,   tier: 2, sp: { spell: 0.5 }, desc: "燃え尽きた賢者の遺灰を固めた杖。" },
  kingslayer:   { name: "王殺しの剣",     type: "weapon",    atk: 34, ac: 0,   tier: 3, sp: { crit: 0.15, boss: 0.6 }, desc: "王と名の付くものに、より深く届く。" },
  dawnSpear:    { name: "夜明けの槍",     type: "weapon",    atk: 31, ac: -2,  tier: 3, sp: { multi: 0.35, drain: 0.15 }, desc: "闇を貫き、光を持ち帰る槍。" },
  voidCutter:   { name: "虚無を断つ刃",   type: "weapon",    atk: 44, ac: -2,  tier: 3, sp: { crit: 0.2, boss: 0.4, multi: 0.2 }, desc: "奈落の王が抱いていた刃。" },
  mailCloak:    { name: "鎖編みの外套",   type: "armor",     atk: 0,  ac: -4,  tier: 1, sp: { evade: 0.05 }, desc: "軽く、音を立てない。" },
  wyrmPlate:    { name: "竜鱗の胸当て",   type: "armor",     atk: 0,  ac: -7,  tier: 1, sp: {}, desc: "古い竜の鱗を縫い合わせた鎧。" },
  thornMail:    { name: "棘の鎧",         type: "armor",     atk: 0,  ac: -7,  tier: 2, sp: { thorns: 0.3 }, desc: "殴った者が血を流す。" },
  saintRobe:    { name: "聖者の法衣",     type: "armor",     atk: 0,  ac: -5,  tier: 2, sp: { ward: true, regen: 2 }, desc: "毒も呪いも、この衣は通さない。" },
  shadeWeave:   { name: "影織りの衣",     type: "armor",     atk: 0,  ac: -6,  tier: 2, sp: { evade: 0.15 }, desc: "敵の目には、影しか映らない。" },
  undyingPlate: { name: "不死者の甲冑",   type: "armor",     atk: 0,  ac: -11, tier: 3, sp: { regen: 5 }, desc: "傷が勝手に塞がっていく。" },
  dawnArmor:    { name: "夜明けの鎧",     type: "armor",     atk: 0,  ac: -12, tier: 3, sp: { ward: true, evade: 0.1 }, desc: "夜明けの色をした、重くない鎧。" },
  rabbitFoot:   { name: "兎の後ろ足",     type: "accessory", atk: 0,  ac: -1,  tier: 1, sp: { luck: 1 }, desc: "宝運が上がる、ありふれたお守り。" },
  swiftRing:    { name: "早駆けの指輪",   type: "accessory", atk: 0,  ac: -1,  tier: 1, sp: { first: true }, desc: "先手を取りやすくなる。" },
  healCharm:    { name: "癒しの護符",     type: "accessory", atk: 0,  ac: -1,  tier: 1, sp: { regen: 2 }, desc: "歩くたびに少しずつ傷が癒える。" },
  beadRosary:   { name: "毒除けの数珠",   type: "accessory", atk: 0,  ac: -1,  tier: 1, sp: { ward: true }, desc: "毒・麻痺・眠りを寄せ付けない。" },
  mageOrb:      { name: "魔導の宝珠",     type: "accessory", atk: 0,  ac: -2,  tier: 2, sp: { spell: 0.35 }, desc: "呪文と祈りの力が増す。" },
  goldScale:    { name: "黄金の天秤",     type: "accessory", atk: 0,  ac: -2,  tier: 2, sp: { luck: 2 }, desc: "宝と金貨が寄ってくる。" },
  oldSeal:      { name: "古き王の印章",   type: "accessory", atk: 2,  ac: -4,  tier: 3, sp: { crit: 0.1, evade: 0.1, luck: 1 }, desc: "かつての王が身に着けていた印章。" },
  bardCrown:    { name: "語り部の冠",     type: "accessory", atk: 0,  ac: -5,  tier: 3, sp: { luck: 2, spell: 0.3, regen: 2 }, desc: "すべての怪物を語り継いだ者の冠。" },
  abyssHeart:   { name: "奈落の心臓",     type: "accessory", atk: 6,  ac: -6,  tier: 3, sp: { drain: 0.2, crit: 0.1, ward: true }, desc: "まだ脈打っている。" }
};
export const TIER_NAMES = ["", "稀少", "秘宝", "伝説"];
export const TIER_COLORS = ["", "#7fb8ff", "#c890ff", "#ffd27a"];

// 敵の落とすレア装備：階が深いほど、周回を重ねるほど、宝運が高いほど出やすい
// kills はその戦闘で倒した数（多いほど少しだけ出やすい）
export function rollRare(floor, cycle, luck, minTier = 0, kills = 1) {
  const base = [0.005, 0.006, 0.008, 0.01, 0.012, 0.025][floor] || 0.012;
  const chance = minTier ? 1 : base * (1 + 0.15 * Math.max(0, kills - 1)) * (1 + cycle * 0.35) * (1 + luck * 0.4);
  if (Math.random() >= chance) return null;
  const r = Math.random();
  let tier = r < 0.03 + floor * 0.012 + cycle * 0.03 ? 3 : r < 0.25 + floor * 0.04 + cycle * 0.04 ? 2 : 1;
  tier = Math.max(tier, minTier);
  const pool = Object.entries(RARES).filter(([id, e]) => e.tier === tier && !["voidCutter", "bardCrown", "abyssHeart"].includes(id));
  return pool[Math.floor(Math.random() * pool.length)][0];
}

// ---- 秘印（4つ集めると奈落の門が開く） ----
export const SIGILS = {
  sigil1: { name: "廃兵の秘印",   holder: "plague_rat",  floor: 0 },
  sigil2: { name: "工房の秘印",   holder: "brass_knight", floor: 1 },
  sigil3: { name: "牢獄の秘印",   holder: "warden",       floor: 2 },
  sigil4: { name: "宝物庫の秘印", holder: "gold_golem",   floor: 3 }
};

// ---- 追加の敵 ----
export const EXTRA_MONSTERS = {
  golden_ghost: { name: "黄金の亡霊", hp: 40, ac: -9, atk: 8, dice: 4, exp: 2600, gold: 4000, skill: "flee", group: [1, 1] },
  abyss_king:   { name: "奈落の王",   hp: 1500, ac: -5, atk: 50, dice: 22, exp: 25000, gold: 30000, skill: "abyss", group: [1, 1] }
};
export const SPRITE_ALIAS = { golden_ghost: "arch_wisp", abyss_king: "void_dragon" };

// ---- 隠し階：地下6階 奈落の底 ----
export const ABYSS_FLOOR = {
  name: "地下6階 奈落の底", color: "#c890ff", start: [1, 1, 1], encounter: 0.11, scale: 1.45,
  intro: "隠章　奈落の底。四つの秘印が重なり合い、床そのものが口を開けた。ここは城が生まれる前からあった場所だ。玉座に座る影が、ゆっくりと顔を上げる。",
  map: [
    "###################",
    "#<....#.....#....T#",
    "#.###.#.###.#.###.#",
    "#.#...#...#...#...#",
    "#.#.#####.#####.###",
    "#.#.....#.....#...#",
    "#.#####.#.###.###.#",
    "#.....#.#.#T#.....#",
    "#####.#.#.#.#.#####",
    "#T....#...B...#..T#",
    "#####.#.#.#.#.#.###",
    "#.....#.#.#.#.#...#",
    "#.#####.###.###.#.#",
    "#.#.......#.....#.#",
    "#.#.#####.#.#####.#",
    "#.#.#.....#.#.....#",
    "#.#.#.#####.#.#####",
    "#...#.......#.....#",
    "###################"
  ],
  events: {
    "1,1": { type: "stairs", to: 4 },
    "17,1": { type: "chest", table: "abyss", once: true },
    "11,7": { type: "chest", table: "abyss", once: true },
    "1,9": { type: "chest", table: "abyss", once: true },
    "17,9": { type: "chest", table: "abyss", once: true },
    "10,9": { type: "boss" }
  },
  monsters: ["dark_lord", "void_dragon", "sin_dragon", "archdemon", "chaos_lord", "pale_rider", "eternal_knight", "death_angel", "abyss_eye", "soul_reaper", "doom_guardian", "ruin_lord"]
};
export const ABYSS_CHEST = { gold: [1500, 3200], item: "malorScroll", trap: 55, rare: 2 };
export const ABYSS_INTRO = "「四つの印を携えて来たか」。奈落の玉座から、底の見えない声が響いた。「この城の主は、最初から我ひとりだ。公よ、隊列よ、お前たちの物語をここで終わらせよう」";
export const ABYSS_END = "奈落の王は、ひび割れた玉座ごと崩れ落ちた。底の見えなかった闇に、初めて底が見えた。";

// ---- 試練の間（町） ----
// 段位ごとに、深い階の敵を強めて戦わせる。勝てばレア装備の機会
export const ARENA = [
  { name: "第一の試練", floor: 0, mult: 1.6, need: 1, rare: 0.35 },
  { name: "第二の試練", floor: 1, mult: 1.8, need: 2, rare: 0.45 },
  { name: "第三の試練", floor: 2, mult: 2.0, need: 3, rare: 0.55 },
  { name: "第四の試練", floor: 3, mult: 2.2, need: 4, rare: 0.65 },
  { name: "最後の試練", floor: 4, mult: 2.5, need: 5, rare: 1.0, minTier: 2 }
];

// ---- 称号 ----
// check(s) は記録 s を見て、達成していれば true を返す
export const ACHIEVEMENTS = [
  { id: "win1",     name: "初陣",             desc: "初めて戦闘に勝つ",               check: s => s.stats.wins >= 1 },
  { id: "win100",   name: "百戦錬磨",         desc: "戦闘に100回勝つ",                 check: s => s.stats.wins >= 100 },
  { id: "win500",   name: "屍の山",           desc: "戦闘に500回勝つ",                 check: s => s.stats.wins >= 500 },
  { id: "win1000",  name: "千の夜を越えて",   desc: "戦闘に1000回勝つ",                check: s => s.stats.wins >= 1000 },
  { id: "chest10",  name: "宝探し",           desc: "宝箱を10個開ける",                check: s => s.stats.chests >= 10 },
  { id: "chest100", name: "宝物庫の主",       desc: "宝箱を100個開ける",               check: s => s.stats.chests >= 100 },
  { id: "rare1",    name: "初めての秘宝",     desc: "レア装備を手に入れる",            check: s => Object.keys(s.rares).length >= 1 },
  { id: "rare10",   name: "秘宝蒐集家",       desc: "レア装備を10種集める",            check: s => Object.keys(s.rares).length >= 10 },
  { id: "legend",   name: "伝説の担い手",     desc: "伝説の装備を手に入れる",          check: (s, R) => Object.keys(s.rares).some(id => R[id]?.tier === 3) },
  { id: "rareAll",  name: "秘宝目録・完",     desc: "レア装備をすべて集める",          check: (s, R) => Object.keys(R).every(id => s.rares[id]) },
  { id: "book25",   name: "見聞録",           desc: "怪物図鑑を25%埋める",             check: s => s.bookPct >= 25 },
  { id: "book50",   name: "怪物学者",         desc: "怪物図鑑を50%埋める",             check: s => s.bookPct >= 50 },
  { id: "book75",   name: "闇の博物誌",       desc: "怪物図鑑を75%埋める",             check: s => s.bookPct >= 75 },
  { id: "book100",  name: "語り部",           desc: "怪物図鑑をすべて埋める",          check: s => s.bookPct >= 100 },
  { id: "sigil1",   name: "秘印の持ち主",     desc: "秘印を一つ手に入れる",            check: s => Object.keys(s.sigils).length >= 1 },
  { id: "sigil4",   name: "四つの印",         desc: "秘印をすべて集める",              check: s => Object.keys(s.sigils).length >= 4 },
  { id: "clear1",   name: "逆襲、成る",       desc: "腐敗した勇者アレックスを倒す",    check: s => s.stats.clears >= 1 },
  { id: "clear2",   name: "二度目の夜明け",   desc: "二周目を攻略する",                check: s => s.stats.clears >= 2 },
  { id: "clear5",   name: "永劫回帰",         desc: "五周目を攻略する",                check: s => s.stats.clears >= 5 },
  { id: "nodeath",  name: "誰も欠けず",       desc: "誰も倒れていない隊列でアレックスを倒す", check: s => s.stats.cleanClear },
  { id: "abyss",    name: "奈落を覗く者",     desc: "地下6階にたどり着く",             check: s => s.stats.abyss },
  { id: "abyssK",   name: "奈落の王を討つ",   desc: "奈落の王を倒す",                  check: s => s.stats.abyssKills >= 1 },
  { id: "gold1",    name: "黄金を見た",       desc: "黄金の亡霊に出会う",              check: s => s.stats.goldSeen >= 1 },
  { id: "gold2",    name: "黄金を討つ",       desc: "黄金の亡霊を倒す",                check: s => s.stats.goldKills >= 1 },
  { id: "arena1",   name: "試練に挑む者",     desc: "試練の間で勝つ",                  check: s => s.stats.arenaBest >= 1 },
  { id: "arena5",   name: "試練の覇者",       desc: "最後の試練に勝つ",                check: s => s.stats.arenaBest >= 5 },
  { id: "lv20",     name: "鍛え抜かれた隊列", desc: "隊列の平均レベルが20に届く",      check: s => s.stats.avgLv >= 20 },
  { id: "lv50",     name: "人の域を越えて",   desc: "誰かがレベル50に届く",            check: s => s.stats.maxLv >= 50 },
  { id: "oneturn",  name: "一閃",             desc: "4体以上の群れを最初の手番で全滅させる", check: s => s.stats.oneTurn },
  { id: "cursed",   name: "呪われし者",       desc: "呪われた装備を身につけてしまう",  check: s => s.stats.cursed }
];
