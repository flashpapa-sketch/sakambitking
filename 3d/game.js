// サカムビット公の逆襲 立体版 ― 本体
// 通常版（main.js）と同じデータ・同じ規則で動く、立体表示の迷宮探索。
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { CLASSES, partyTemplate, EQUIPMENT, ITEMS, SPELLS, CHESTS, MONSTERS, FLOORS, SPRITES, PROLOGUE, BOSS_INTRO } from "./data.js";

// ================================================================
// 基本設定
// ================================================================
const SAVE_KEY = "sakambit_3d_v1";
const CELL = 2, WALL_H = 2.6, EYE = 1.15;
const DIRS = [{ dx: 0, dy: -1, n: "北" }, { dx: 1, dy: 0, n: "東" }, { dx: 0, dy: 1, n: "南" }, { dx: -1, dy: 0, n: "西" }];
const THEMES = [
  { fog: 0x050302, flame: 0xffb060, light: 0xff8a30, wall: 0xffffff, drone: 55 },
  { fog: 0x02050a, flame: 0x80c8ff, light: 0x4a9cff, wall: 0xc8d4e8, drone: 49 },
  { fog: 0x050309, flame: 0xc890ff, light: 0x9a5cff, wall: 0xc4bccc, drone: 46 },
  { fog: 0x070500, flame: 0xffd27a, light: 0xffb340, wall: 0xf0dcb0, drone: 52 },
  { fog: 0x090101, flame: 0xff6a50, light: 0xff3020, wall: 0xe0b8b0, drone: 41 }
];
// 絵が用意されている敵（通常版と同じ割り当て）
const MONSTER_ART = {
  rat: "001_rat", dungeon_rat: "001_rat", plague_rat: "009_rat_elite", kobold: "005_jackal",
  hound: "002_wolf", wolf_shade: "010_wolf_elite", shadow_dog: "008_hyena", cave_bear: "007_bear",
  stone_troll: "006_gorilla", mud_troll: "014_gorilla_elite"
};
const STATUS_LABELS = { poison: "毒", sleep: "睡眠", paralyze: "麻痺", burn: "炎上", bleed: "出血", slow: "鈍化" };
const ENDING_HTML = `
  <h1>逆襲、成る</h1>
  <p>勇者アレックスは玉座の前に崩れ落ち、その身は灰となって石床に溶けた。デスフォールの王座は、ついに正統の主を迎えた。</p>
  <p>だが公は玉座に座らず、ただ振り返る。そこには傷だらけの六人の隊列が、なお肩を並べて立っていた。王冠を取り戻すための戦いは、いつしか隊列を取り戻すための戦いになっていたのだ。</p>
  <p>……城の外では、夜明けの鐘が鳴り始めている。</p>
  <p class="gold">攻略完了</p>`;

const $ = id => document.getElementById(id);
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const choose = list => list[Math.floor(Math.random() * list.length)];
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ================================================================
// 音（すべてその場で合成）
// ================================================================
const audio = {
  ctx: null, master: null, noiseBuf: null, amb: null,
  init() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.55;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // 残響（石の空間）
    this.verb = this.ctx.createConvolver();
    const ir = this.ctx.createBuffer(2, len * 2, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const b = ir.getChannelData(ch); for (let i = 0; i < b.length; i++) b[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / b.length, 3.2); }
    this.verb.buffer = ir;
    this.verbGain = this.ctx.createGain(); this.verbGain.gain.value = 0.32;
    this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
  },
  out(node, wet = true) { node.connect(this.master); if (wet && this.verb) node.connect(this.verb); },
  tone(f, dur, type = "sine", vol = 0.2, slide = 0, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); this.out(g); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, vol, freq, type = "lowpass", delay = 0, q = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay, s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); this.out(g); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  },
  step() { this.noise(0.11, 0.22, 380); this.tone(62, 0.09, "sine", 0.18); },
  turn() { this.noise(0.22, 0.05, 1200, "bandpass"); },
  bump() { this.tone(48, 0.22, "sine", 0.45); this.noise(0.15, 0.25, 260); },
  hit() { this.noise(0.2, 0.42, 2200); this.tone(130, 0.18, "square", 0.12, -80); this.tone(60, 0.2, "sine", 0.3); },
  crit() { this.hit(); this.tone(880, 0.25, "triangle", 0.1, -400, 0.03); },
  miss() { this.noise(0.14, 0.1, 3500, "highpass"); },
  hurt() { this.tone(90, 0.3, "sawtooth", 0.16, -50); this.noise(0.22, 0.3, 700); },
  fire() { this.noise(0.9, 0.35, 900, "lowpass", 0, 0.7); this.tone(180, 0.7, "sawtooth", 0.08, 260); },
  spell() { this.tone(420, 0.5, "sine", 0.1, 900); this.tone(630, 0.6, "triangle", 0.07, 1200, 0.06); },
  heal() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.5, "sine", 0.1, 0, i * 0.07)); },
  encounter() { [196, 208, 196, 185].forEach((f, i) => this.tone(f, 0.16, "square", 0.08, 0, i * 0.09)); this.tone(98, 0.6, "sawtooth", 0.1, 0, 0.36); },
  boss() { [110, 104, 98, 92].forEach((f, i) => this.tone(f, 0.5, "sawtooth", 0.14, 0, i * 0.22)); this.noise(1.8, 0.25, 160, "lowpass", 0.2); },
  victory() { [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.35, "triangle", 0.12, 0, i * 0.1)); },
  levelup() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.3, "square", 0.06, 0, i * 0.08)); },
  chest() { this.tone(240, 0.12, "square", 0.1); this.tone(180, 0.2, "square", 0.08, 0, 0.1); },
  coin() { [1318, 1760].forEach((f, i) => this.tone(f, 0.18, "square", 0.06, 0, i * 0.07)); },
  stairs() { for (let i = 0; i < 5; i++) { this.noise(0.1, 0.18, 400, "lowpass", i * 0.14); this.tone(70 - i * 4, 0.1, "sine", 0.15, 0, i * 0.14); } },
  curse() { this.tone(160, 1.0, "sawtooth", 0.08, -100); this.tone(170, 1.0, "sawtooth", 0.08, -110); },
  ambient(fi) {
    if (!this.ctx) return;
    if (this.amb) { const old = this.amb; old.g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.6); setTimeout(() => old.nodes.forEach(n => { try { n.stop(); } catch {} }), 3000); }
    const base = THEMES[fi]?.drone || 55, g = this.ctx.createGain(); g.gain.value = 0.0001;
    g.gain.setTargetAtTime(1, this.ctx.currentTime, 1.5); g.connect(this.master); if (this.verb) g.connect(this.verb);
    const nodes = [];
    for (const [f, v] of [[base, 0.05], [base * 1.498, 0.025], [base * 0.5, 0.05]]) {
      const o = this.ctx.createOscillator(), og = this.ctx.createGain(); o.type = "sine"; o.frequency.value = f; o.detune.value = rand(-8, 8);
      og.gain.value = v; o.connect(og); og.connect(g); o.start(); nodes.push(o);
    }
    // 風の音（ゆっくり揺れる帯域雑音）
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 320; f.Q.value = 0.8;
    const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 180;
    lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    const wg = this.ctx.createGain(); wg.gain.value = 0.05; s.connect(f); f.connect(wg); wg.connect(g); s.start();
    nodes.push(s, lfo);
    this.amb = { g, nodes };
  }
};

// ================================================================
// 描画の土台
// ================================================================
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.outputColorSpace = THREE.SRGBColorSpace;
$("view").appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020101);
scene.fog = new THREE.FogExp2(0x040201, 0.11);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 80);
scene.add(camera);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.5, 0.88);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uHurt: { value: 0 }, uTint: { value: new THREE.Vector3(0, 0, 0) } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uHurt; uniform vec3 uTint; varying vec2 vUv;
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float ca = 0.0036 * length(c);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + c * ca).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - c * ca).b;
      float vig = smoothstep(0.85, 0.25, length(c * vec2(1.0, 0.85)));
      col *= mix(0.35, 1.0, vig);
      col = mix(col, col * vec3(1.03, 0.99, 0.95), 0.5);
      col += uTint;
      col += (rnd(vUv * 900.0) - 0.5) * 0.018;
      col = mix(col, vec3(0.5, 0.0, 0.0), uHurt * (1.0 - vig) * 0.8);
      gl_FragColor = vec4(col, 1.0);
    }`
});
composer.addPass(grade);
composer.addPass(new OutputPass());

// ================================================================
// 質感（手続き生成。高さ情報から法線を計算して凹凸を出す）
// ================================================================
function makeNoise(period, seed) {
  const g = new Float32Array(period * period);
  let x = seed * 9301 + 49297;
  for (let i = 0; i < g.length; i++) { x = (x * 9301 + 49297) % 233280; g[i] = x / 233280; }
  return (u, v) => {
    const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = (X, Y) => g[((Y % period + period) % period) * period + ((X % period + period) % period)];
    const top = a(x0, y0) + (a(x0 + 1, y0) - a(x0, y0)) * sx;
    const bot = a(x0, y0 + 1) + (a(x0 + 1, y0 + 1) - a(x0, y0 + 1)) * sx;
    return top + (bot - top) * sy;
  };
}
function fbm(noises, u, v) { let s = 0, amp = 0.5, f = 1; for (const n of noises) { s += n(u * f, v * f) * amp; amp *= 0.5; f *= 2; } return s; }
function makeStone(kind) {
  const S = 512;
  const rows = kind === "wall" ? 7 : kind === "floor" ? 4 : 2;
  const cols = kind === "wall" ? 3 : kind === "floor" ? 3 : 2;
  const base = kind === "wall" ? [104, 98, 90] : kind === "floor" ? [82, 76, 70] : [56, 52, 50];
  const noises = [8, 16, 32, 64, 128].map((p, k) => { const n = makeNoise(p, k * 17 + (kind === "wall" ? 3 : kind === "floor" ? 7 : 11)); return (u, v) => n(u * p / 8, v * p / 8); });
  const big = makeNoise(4, 99);
  const height = new Float32Array(S * S), albedo = new Uint8ClampedArray(S * S * 4);
  const brickRand = [];
  for (let r = 0; r < rows; r++) { brickRand[r] = []; for (let c = 0; c <= cols; c++) brickRand[r][c] = [Math.random(), Math.random(), Math.random()]; }
  const mortar = kind === "ceil" ? 0.03 : 0.045;
  for (let y = 0; y < S; y++) {
    const v = y / S, ry = v * rows, r = Math.floor(ry), fy = ry - r, off = (r % 2) * 0.5;
    for (let x = 0; x < S; x++) {
      const u = x / S, cx = u * cols + off, c = Math.floor(cx) % cols, fx = cx - Math.floor(cx);
      const br = brickRand[r][(c + cols) % cols];
      const ex = Math.min(fx, 1 - fx) * (S / cols), ey = Math.min(fy, 1 - fy) * (S / rows);
      const edge = Math.min(ex, ey) / (S * mortar) + (fbm(noises, u * 8, v * 8) - 0.5) * 1.6;
      const inStone = Math.max(0, Math.min(1, edge)), bevel = Math.pow(inStone, 0.45);
      const rough = fbm(noises, u * 8 + br[0] * 3, v * 8 + br[1] * 3);
      height[y * S + x] = bevel * (0.62 + br[2] * 0.18) + (rough - 0.5) * 0.28 * bevel;
      const tint = (br[0] - 0.5) * 30, blot = (big(u * 4, v * 4) - 0.5) * 34 + (rough - 0.5) * 44, ao = 0.35 + 0.65 * bevel;
      let R = (base[0] + tint + blot) * ao, G = (base[1] + tint * 0.9 + blot) * ao, B = (base[2] + tint * 0.8 + blot * 0.9) * ao;
      if (kind === "wall" && inStone < 0.6) { const m = (fbm(noises, u * 8 + 5, v * 8) - 0.4) * 1.4; if (m > 0) { R -= 18 * m; G += 6 * m; B -= 14 * m; } }
      const k = (y * S + x) * 4; albedo[k] = R; albedo[k + 1] = G; albedo[k + 2] = B; albedo[k + 3] = 255;
    }
  }
  const c1 = document.createElement("canvas"); c1.width = c1.height = S;
  const g1 = c1.getContext("2d"); g1.putImageData(new ImageData(albedo, S, S), 0, 0);
  g1.strokeStyle = "rgba(10,8,6,.55)"; g1.lineWidth = 1;
  for (let n = 0; n < (kind === "ceil" ? 6 : 14); n++) {
    let px = Math.random() * S, py = Math.random() * S, a = Math.random() * Math.PI * 2;
    g1.beginPath(); g1.moveTo(px, py);
    for (let t = 0; t < 14; t++) {
      a += (Math.random() - 0.5) * 1.1; px += Math.cos(a) * 6; py += Math.sin(a) * 6; g1.lineTo(px, py);
      const hx = Math.floor(px), hy = Math.floor(py); if (hx >= 0 && hy >= 0 && hx < S && hy < S) height[hy * S + hx] -= 0.12;
    }
    g1.stroke();
  }
  const nrm = new Uint8ClampedArray(S * S * 4), str = kind === "ceil" ? 3.0 : 4.0;
  const H = (x, y) => height[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * str, dy = (H(x, y + 1) - H(x, y - 1)) * str, l = Math.hypot(dx, dy, 1), k = (y * S + x) * 4;
    nrm[k] = (-dx / l * 0.5 + 0.5) * 255; nrm[k + 1] = (dy / l * 0.5 + 0.5) * 255; nrm[k + 2] = (1 / l * 0.5 + 0.5) * 255; nrm[k + 3] = 255;
  }
  const c2 = document.createElement("canvas"); c2.width = c2.height = S;
  c2.getContext("2d").putImageData(new ImageData(nrm, S, S), 0, 0);
  const map = new THREE.CanvasTexture(c1); map.colorSpace = THREE.SRGBColorSpace;
  const normal = new THREE.CanvasTexture(c2);
  for (const t of [map, normal]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); }
  return { map, normal };
}
const wallTex = makeStone("wall"), floorTex = makeStone("floor"), ceilTex = makeStone("ceil");
const wallMat = new THREE.MeshStandardMaterial({ map: wallTex.map, normalMap: wallTex.normal, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.9 });

function glowTexture(inner, outer) {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.35, outer); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const flameTex = glowTexture("rgba(255,250,220,1)", "rgba(255,140,40,.8)");
const runeTex = glowTexture("rgba(200,240,255,1)", "rgba(80,160,255,.6)");
const dustTex = glowTexture("rgba(255,230,190,.9)", "rgba(255,200,140,.25)");

// ドット絵を「Scale2x」で3回拡大（24→192）し、輪郭をなめらかにしてから陰影と縁取りを付ける
function scale2x(src, W, H) {
  const dst = new Array(W * 2 * H * 2), at = (x, y) => src[Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
    let e0 = P, e1 = P, e2 = P, e3 = P;
    if (C === A && C !== D && A !== B) e0 = A;
    if (A === B && A !== C && B !== D) e1 = B;
    if (D === C && D !== B && C !== A) e2 = C;
    if (B === D && B !== A && D !== C) e3 = D;
    const o = (y * 2) * W * 2 + x * 2;
    dst[o] = e0; dst[o + 1] = e1; dst[o + W * 2] = e2; dst[o + W * 2 + 1] = e3;
  }
  return dst;
}
function spriteCanvas(id) {
  const spr = SPRITES[id] || SPRITES.skeleton, rows = spr.d, H0 = rows.length, W0 = rows[0].length;
  let px = [];
  for (let r = 0; r < H0; r++) for (let c = 0; c < W0; c++) { const ch = rows[r][c]; px.push(ch === "." || ch === "0" ? 0 : parseInt(ch, 16)); }
  let W = W0, H = H0;
  for (let i = 0; i < 3; i++) { px = scale2x(px, W, H); W *= 2; H *= 2; }
  const pad = 8, c = document.createElement("canvas"); c.width = W + pad * 2; c.height = H + pad * 2;
  const g = c.getContext("2d"), img = g.createImageData(W, H);
  const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = px[y * W + x], k = (y * W + x) * 4; if (!v || !spr.p[v]) continue;
    const [r, gg, b] = rgb(spr.p[v]);
    const shade = 1.12 - (y / H) * 0.38;   // 上から光が当たったような陰影
    img.data[k] = Math.min(255, r * shade); img.data[k + 1] = Math.min(255, gg * shade); img.data[k + 2] = Math.min(255, b * shade); img.data[k + 3] = 255;
  }
  // 縁取り（暗い輪郭）を先に描き、その上に本体を重ねる
  const tmp = document.createElement("canvas"); tmp.width = W; tmp.height = H; tmp.getContext("2d").putImageData(img, 0, 0);
  g.filter = "brightness(0) opacity(0.85)";
  for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, 2], [-2, 2], [2, -2]]) g.drawImage(tmp, pad + dx, pad + dy);
  g.filter = "none";
  g.drawImage(tmp, pad, pad);
  return c;
}

// 敵の絵（用意された絵があれば使い、なければ通常版のドット絵から作る）
const texCache = {};
const loader = new THREE.TextureLoader();
function monsterTexture(id) {
  if (texCache[id]) return texCache[id];
  let tex;
  if (MONSTER_ART[id]) {
    tex = loader.load(`img/monsters/${MONSTER_ART[id]}.png`);
  } else {
    tex = new THREE.CanvasTexture(spriteCanvas(id));
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache[id] = tex;
  return tex;
}

// ================================================================
// 光・塵・火花
// ================================================================
const torchLight = new THREE.PointLight(0xffc08a, 9, 20, 1.25);
torchLight.castShadow = true;
torchLight.shadow.mapSize.set(512, 512);
torchLight.shadow.bias = -0.004;
torchLight.shadow.radius = 4;
camera.add(torchLight);
torchLight.position.set(0.35, -0.15, 0.1);
const hemi = new THREE.HemisphereLight(0x2a2a34, 0x0a0806, 0.5);
scene.add(hemi);
const spellLight = new THREE.PointLight(0xff7a20, 0, 10, 1.4);
scene.add(spellLight);

const DUST = 600, dustGeo = new THREE.BufferGeometry();
const dustPos = new Float32Array(DUST * 3), dustVel = new Float32Array(DUST * 3);
for (let i = 0; i < DUST; i++) {
  dustPos.set([(Math.random() - 0.5) * 14, Math.random() * WALL_H, (Math.random() - 0.5) * 14], i * 3);
  dustVel.set([(Math.random() - 0.5) * 0.004, (Math.random() - 0.3) * 0.002, (Math.random() - 0.5) * 0.004], i * 3);
}
dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: dustTex, size: 0.05, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 })));

const SP = 600, spGeo = new THREE.BufferGeometry();
const spPos = new Float32Array(SP * 3), spVel = new Float32Array(SP * 3), spLife = new Float32Array(SP), spCol = new Float32Array(SP * 3);
spGeo.setAttribute("position", new THREE.BufferAttribute(spPos, 3));
spGeo.setAttribute("color", new THREE.BufferAttribute(spCol, 3));
const sparkPoints = new THREE.Points(spGeo, new THREE.PointsMaterial({ map: flameTex, size: 0.1, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
sparkPoints.frustumCulled = false; scene.add(sparkPoints);
let spNext = 0;
function burst(at, n, spread, color = [1, 0.8, 0.5], up = 0.9, gravity = 1) {
  for (let i = 0; i < n; i++) {
    const k = spNext = (spNext + 1) % SP;
    spPos.set([at.x + (Math.random() - 0.5) * 0.3, at.y + (Math.random() - 0.5) * 0.3, at.z + (Math.random() - 0.5) * 0.3], k * 3);
    spVel.set([(Math.random() - 0.5) * spread, Math.random() * spread * up, (Math.random() - 0.5) * spread], k * 3);
    spCol.set(color.map(c => c * (0.7 + Math.random() * 0.3)), k * 3);
    spLife[k] = (0.5 + Math.random() * 0.6) * (gravity < 1 ? 2 : 1);
    spVel[k * 3 + 1] *= gravity < 1 ? 0.3 : 1;
  }
  sparkPoints.userData.gravity = gravity;
}

// ================================================================
// 状態
// ================================================================
let state = null;          // 冒険の記録
let mode = "title";        // title / explore / battle / modal / dead / ending
let world = null;          // 現在の階の立体物
let battle = null;
let busy = false;          // 演出中は入力を受けない
let dark = 0, noSpell = 0;

function makeMember(t) {
  const c = CLASSES[t.cls];
  return { ...t, className: c.label, lv: 1, exp: 0, hp: c.hp, maxHp: c.hp, mp: [...c.mp], maxMp: [...c.mp], atk: c.atk, baseAc: c.ac,
    int: c.int, pie: c.pie, agi: c.agi, status: {},
    equip: { weapon: t.cls === "mage" || t.cls === "priest" ? "shortSword" : "longSword", armor: t.cls === "mage" ? "robe" : "chain", accessory: null } };
}
function newState() {
  const s = FLOORS[0].start;
  return { floor: 0, x: s[0], y: s[1], dir: s[2], gold: 180, steps: 0, danger: 0, flags: { intro0: true }, seen: {},
    inventory: { potion: 4, ether: 1, antidote: 1, stoneCure: 0, malorScroll: 1 }, stock: {}, party: partyTemplate.map(makeMember) };
}
const F = () => FLOORS[state.floor];
const tile = (x, y) => (F().map[y] || "")[x] || "#";
const isWall = (x, y) => tile(x, y) === "#";
const living = () => state.party.filter(p => p.hp > 0 && !p.dead);
const frontRow = () => state.party.slice(0, 3).filter(p => p.hp > 0 && !p.dead);
function acOf(p) { let ac = p.baseAc; for (const id of Object.values(p.equip)) if (id && EQUIPMENT[id]) ac += EQUIPMENT[id].ac; if (p.status.sleep) ac += 3; return ac; }
const atkOf = p => p.atk + (EQUIPMENT[p.equip.weapon]?.atk || 0);
const hitRate = (power, ac) => Math.max(0.12, Math.min(0.9, 0.58 + power * 0.018 - ac * 0.035));

// ================================================================
// 画面の文字
// ================================================================
let msgLines = [];
function say(text, append = false) {
  if (!append) msgLines = [];
  msgLines.push(...String(text).split("\n"));
  msgLines = msgLines.slice(-30);
  const el = $("msg"); el.textContent = msgLines.join("\n"); el.scrollTop = el.scrollHeight;
}
function renderParty() {
  $("party").innerHTML = state.party.map((p, i) => {
    const pct = Math.max(0, p.hp / p.maxHp * 100);
    const st = p.dead ? (p.dead === "ashes" ? "灰" : p.dead === "lost" ? "消失" : "死亡") : Object.keys(p.status || {}).filter(k => p.status[k]).map(k => STATUS_LABELS[k] || k).join(" ");
    const mp = p.maxMp.some(v => v > 0) ? `　呪 ${p.mp.join("/")}` : "";
    return `<div class="pm panel${p.dead || p.hp <= 0 ? " dead" : ""}" id="pm${i}">
      <span class="row-tag">${i < 3 ? "前" : "後"}</span>
      <div class="nm">${p.name}</div>
      <div class="cl">${p.className} レベル${p.lv}${mp}</div>
      <div>体力 ${p.hp}/${p.maxHp}</div>
      <div class="bar${pct < 30 ? " low" : ""}"><i style="width:${pct}%"></i></div>
      <div class="st">${st}</div></div>`;
  }).join("");
}
function renderHud() {
  $("floorName").textContent = F().name;
  $("status").textContent = `向き ${DIRS[state.dir].n}　所持金 ${state.gold}${dark > 0 ? `　暗闇 残${dark}歩` : ""}${noSpell > 0 ? `　魔封じ 残${noSpell}歩` : ""}`;
  renderParty(); drawMap();
}
function partyCardHurt(i) { const el = $("pm" + i); if (el) { el.classList.remove("hurt"); void el.offsetWidth; el.classList.add("hurt"); } }
function flash(color, ms = 300) {
  const el = $("flash"); el.style.background = color;
  el.animate([{ opacity: 0.55 }, { opacity: 0 }], { duration: ms, easing: "ease-out" });
}
function popAt(vec3, text, color = "#fff2c0", size = 34) {
  const p = vec3.clone().project(camera);
  const el = document.createElement("div"); el.className = "pop"; el.textContent = text;
  el.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`; el.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight}px`;
  el.style.color = color; el.style.fontSize = `${size}px`;
  document.body.appendChild(el);
  el.animate([{ opacity: 0, transform: "translate(-50%, 10px) scale(.6)" }, { opacity: 1, transform: "translate(-50%, -10px) scale(1.15)", offset: 0.2 },
    { opacity: 0, transform: "translate(-50%, -60px) scale(1)" }], { duration: 1000, easing: "ease-out" }).onfinish = () => el.remove();
}

// ================================================================
// 地図
// ================================================================
function reveal() {
  const k = `f${state.floor}`; state.seen[k] ||= {};
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) state.seen[k][`${state.x + dx},${state.y + dy}`] = 1;
}
function drawMapTo(c) {
  const g = c.getContext("2d"), map = F().map, n = map.length, s = Math.floor(c.width / n), seen = state.seen[`f${state.floor}`] || {};
  g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < n; y++) for (let x = 0; x < map[y].length; x++) {
    if (!seen[`${x},${y}`]) continue;
    const ch = map[y][x];
    g.fillStyle = ch === "#" ? "#3a332c" : ch === ">" || ch === "<" ? "#3c7fa8" : ch === "T" ? "#7a5a20" : ch === "B" ? "#8a2020" : "#1d3a24";
    g.fillRect(x * s, y * s, s - 1, s - 1);
  }
  const d = DIRS[state.dir], cx = state.x * s + s / 2, cy = state.y * s + s / 2;
  g.fillStyle = "#ff6666"; g.beginPath();
  g.moveTo(cx + d.dx * s * 0.6, cy + d.dy * s * 0.6);
  g.lineTo(cx - d.dy * s * 0.45 - d.dx * s * 0.35, cy + d.dx * s * 0.45 - d.dy * s * 0.35);
  g.lineTo(cx + d.dy * s * 0.45 - d.dx * s * 0.35, cy - d.dx * s * 0.45 - d.dy * s * 0.35);
  g.fill();
}
function drawMap() { drawMapTo($("map")); if (!$("mapBig").classList.contains("hidden")) drawMapTo($("mapBigC")); }
function toggleMap() { const m = $("mapBig"); m.classList.toggle("hidden"); drawMap(); }
$("mapPanel").addEventListener("click", toggleMap);
$("mapBig").addEventListener("click", toggleMap);

// ================================================================
// 階の組み立て
// ================================================================
function buildFloor(fi) {
  if (world) { scene.remove(world.group); world.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  const Fl = FLOORS[fi], H = Fl.map.length, W = Fl.map[0].length, TH = THEMES[fi] || THEMES[0];
  scene.fog.color.setHex(TH.fog); scene.background.setHex(TH.fog); wallMat.color.setHex(TH.wall);
  const group = new THREE.Group(), flames = [], runes = [], chests = {};

  const walls = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Fl.map[y][x] === "#") walls.push([x, y]);
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, WALL_H, CELL), wallMat, walls.length);
  const m4 = new THREE.Matrix4();
  walls.forEach(([x, y], i) => { m4.makeTranslation(x * CELL, WALL_H / 2, y * CELL); inst.setMatrixAt(i, m4); });
  inst.castShadow = true; inst.receiveShadow = true; group.add(inst);

  const plane = (tex, nscale, rough, y, rx) => {
    const m = tex.map.clone(), n = tex.normal.clone();
    for (const t of [m, n]) { t.repeat.set(W, H); t.needsUpdate = true; }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W * CELL, H * CELL), new THREE.MeshStandardMaterial({ map: m, normalMap: n, normalScale: new THREE.Vector2(nscale, nscale), roughness: rough }));
    mesh.rotation.x = rx; mesh.position.set((W - 1) * CELL / 2, y, (H - 1) * CELL / 2); mesh.receiveShadow = true; group.add(mesh);
  };
  plane(floorTex, 1.3, 0.82, 0, -Math.PI / 2);
  plane(ceilTex, 1.1, 1, WALL_H, Math.PI / 2);

  const puddleMat = new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.32, depthWrite: false });
  for (let n = 0; n < 10; n++) {
    const x = 1 + Math.floor(Math.random() * (W - 2)), y = 1 + Math.floor(Math.random() * (H - 2));
    if (Fl.map[y][x] === "#") continue;
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.3 + Math.random() * 0.3, 24), puddleMat);
    p.scale.set(1, 0.6 + Math.random() * 0.4, 1); p.rotation.x = -Math.PI / 2;
    p.position.set(x * CELL + (Math.random() - 0.5), 0.005, y * CELL + (Math.random() - 0.5)); group.add(p);
  }

  // 燭台
  const cands = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (Fl.map[y][x] === "#") continue;
    for (const d of DIRS) if (Fl.map[y + d.dy][x + d.dx] === "#") cands.push({ x, y, d });
  }
  cands.sort(() => Math.random() - 0.5);
  const sconceMat = new THREE.MeshStandardMaterial({ color: 0x2a1c10, roughness: 0.6, metalness: 0.7 });
  const used = new Set();
  for (const c of cands) {
    if (flames.length >= 10) break;
    if ([...used].some(k => { const [ux, uy] = k.split(",").map(Number); return Math.abs(ux - c.x) + Math.abs(uy - c.y) < 4; })) continue;
    used.add(`${c.x},${c.y}`);
    const px = c.x * CELL + c.d.dx * (CELL / 2 - 0.08), pz = c.y * CELL + c.d.dy * (CELL / 2 - 0.08);
    const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.35, 8), sconceMat);
    holder.position.set(px, 1.55, pz); holder.castShadow = true; group.add(holder);
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: TH.flame, blending: THREE.AdditiveBlending, depthWrite: false }));
    fl.position.set(px, 1.82, pz); fl.scale.set(0.42, 0.6, 1); group.add(fl);
    const pl = new THREE.PointLight(TH.light, 9, 7, 1.8);
    pl.position.set(px - c.d.dx * 0.25, 1.8, pz - c.d.dy * 0.25); group.add(pl);
    flames.push({ fl, pl, seed: Math.random() * 100, base: 9 });
  }

  // 特別なマス
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = Fl.map[y][x], px = x * CELL, pz = y * CELL;
    if (ch === ">" || ch === "<") {
      const col = ch === ">" ? 0x7fd0ff : 0xffe08a;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(px, 0.02, pz); group.add(ring);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: runeTex, color: col, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.set(px, 0.5, pz); glow.scale.set(1.2, 1.2, 1); group.add(glow); runes.push(glow);
    }
    if (ch === "T") {
      const chest = new THREE.Group();
      const wood = new THREE.MeshStandardMaterial({ color: 0x5a3416, roughness: 0.7 });
      const gold = new THREE.MeshStandardMaterial({ color: 0xc8a040, roughness: 0.3, metalness: 0.9, emissive: 0x3a2400 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), wood); body.position.y = 0.25;
      const lidG = new THREE.Group(); lidG.position.set(0, 0.5, -0.3);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16, 1, false, 0, Math.PI), wood); lid.rotation.z = Math.PI / 2; lid.position.z = 0.3;
      lidG.add(lid);
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.08, 0.64), gold); band.position.y = 0.3;
      for (const m of [body, lid, band]) { m.castShadow = true; m.receiveShadow = true; }
      chest.add(body, lidG, band); chest.position.set(px, 0, pz); group.add(chest);
      const shine = new THREE.Sprite(new THREE.SpriteMaterial({ map: runeTex, color: 0xffd27a, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 }));
      shine.position.set(px, 0.7, pz); shine.scale.set(0.8, 0.8, 1); group.add(shine);
      chests[`${x},${y}`] = { lidG, shine };
      if (state.flags[`e_${fi}_${x},${y}`]) { lidG.rotation.x = -1.2; shine.visible = false; }
    }
    if (ch === "E" || ch === "K") {
      if (ch === "K" && state.flags.b1Key && fi === 0) continue;
      if (ch === "K" && state.flags.royalSeal && fi === 3) continue;
      const col = ch === "E" ? 0x9fe0ff : 0xffd27a;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: runeTex, color: col, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.position.set(px, 1.0, pz); s.scale.set(0.7, 0.7, 1); group.add(s); runes.push(s);
      s.userData.cell = `${x},${y}`;
    }
    if (ch === "B") {
      const throne = new THREE.Group();
      const stone = new THREE.MeshStandardMaterial({ color: 0x2a2224, roughness: 0.55, metalness: 0.2 });
      const goldM = new THREE.MeshStandardMaterial({ color: 0xc8a040, roughness: 0.25, metalness: 1, emissive: 0x2a1800 });
      const cloth = new THREE.MeshStandardMaterial({ color: 0x7a0c10, roughness: 0.9 });
      for (const [geo, mat, x2, y2, z2] of [
        [new THREE.BoxGeometry(1.3, 0.45, 1.0), stone, 0, 0.22, 0], [new THREE.BoxGeometry(1.3, 2.2, 0.22), stone, 0, 1.1, -0.45],
        [new THREE.BoxGeometry(0.18, 0.75, 0.9), stone, -0.6, 0.62, 0], [new THREE.BoxGeometry(0.18, 0.75, 0.9), stone, 0.6, 0.62, 0],
        [new THREE.BoxGeometry(1.0, 0.06, 0.75), cloth, 0, 0.48, 0.05], [new THREE.BoxGeometry(0.9, 1.5, 0.04), cloth, 0, 1.15, -0.33],
        [new THREE.BoxGeometry(1.42, 0.08, 0.3), goldM, 0, 2.2, -0.45], [new THREE.ConeGeometry(0.12, 0.35, 8), goldM, -0.5, 2.42, -0.45],
        [new THREE.ConeGeometry(0.16, 0.5, 8), goldM, 0, 2.5, -0.45], [new THREE.ConeGeometry(0.12, 0.35, 8), goldM, 0.5, 2.42, -0.45]]) {
        const m = new THREE.Mesh(geo, mat); m.position.set(x2, y2, z2); m.castShadow = true; m.receiveShadow = true; throne.add(m);
      }
      throne.position.set(px, 0, pz); throne.rotation.y = -Math.PI / 2; group.add(throne);
      const red = new THREE.PointLight(0xff2010, 14, 9, 1.6); red.position.set(px - 0.8, 2.2, pz); group.add(red);
      flames.push({ fl: new THREE.Object3D(), pl: red, seed: 3, base: 14 });
    }
  }
  scene.add(group);
  world = { group, flames, runes, chests };
}

// ================================================================
// 移動
// ================================================================
const anim = { from: new THREE.Vector3(), to: new THREE.Vector3(), yaw0: 0, yaw1: 0, t: 1, dur: 0.22, start: 0 };
const yawOf = d => -d * Math.PI / 2;
function placeCamera() {
  camera.position.set(state.x * CELL, EYE, state.y * CELL);
  camera.rotation.set(0, yawOf(state.dir), 0, "YXZ");
  anim.from.copy(camera.position); anim.to.copy(camera.position); anim.yaw0 = anim.yaw1 = yawOf(state.dir); anim.t = 1;
}
function startAnim(dur) { anim.from.copy(camera.position); anim.yaw0 = camera.rotation.y; anim.t = 0; anim.dur = dur; anim.start = performance.now(); }
function finishAnim() { camera.position.copy(anim.to); camera.position.y = EYE; camera.rotation.y = yawOf(state.dir); anim.t = 1; }
function turnTo(dir, dur) {
  state.dir = dir; startAnim(dur);
  let target = yawOf(dir);
  while (target - anim.yaw0 > Math.PI) target -= Math.PI * 2;
  while (target - anim.yaw0 < -Math.PI) target += Math.PI * 2;
  anim.yaw1 = target; anim.to.copy(camera.position);
}

function encounterRate() {
  const thief = state.party.find(p => p.cls === "thief" && p.hp > 0 && !p.dead);
  return Math.max(0.04, F().encounter + Math.min(0.08, state.danger / 900) - (thief ? 0.015 : 0));
}
function tickStatuses() {
  const log = [];
  for (const p of living()) {
    if (p.status.poison) { p.hp = Math.max(1, p.hp - 2); log.push(`${p.name}は毒に蝕まれている。`); }
    if (p.status.bleed) { p.hp = Math.max(1, p.hp - 3); log.push(`${p.name}は出血している。`); }
    if (p.status.burn) { p.hp = Math.max(1, p.hp - 4); log.push(`${p.name}は炎に焼かれている。`); if (Math.random() < 0.3) delete p.status.burn; }
    if (p.status.slow && Math.random() < 0.4) delete p.status.slow;
  }
  return log;
}

function moveForward() {
  const d = DIRS[state.dir], nx = state.x + d.dx, ny = state.y + d.dy;
  if (isWall(nx, ny)) { audio.bump(); bumpT = 1; say("冷たい石壁だ。"); return; }
  // 玉座のマスには踏み込まず、その手前で決戦になる
  if (tile(nx, ny) === "B") { say("玉座の前に立った。冷たい気配が背筋を這い上がる。"); setTimeout(() => startBattle("boss"), 500); return; }
  audio.step();
  state.x = nx; state.y = ny; state.steps++; state.danger += 1 + state.floor;
  if (dark > 0) dark--; if (noSpell > 0) noSpell--;
  startAnim(0.26); anim.to.set(nx * CELL, EYE, ny * CELL); anim.yaw1 = anim.yaw0;
  reveal();
  const log = tickStatuses();
  if (log.length) say(log.join("\n"));
  const triggered = handleEvent();
  renderHud();
  if (!triggered && mode === "explore" && Math.random() < encounterRate()) setTimeout(() => startBattle(), 280);
}

// ================================================================
// 出来事（通常版と同じ規則）
// ================================================================
function handleEvent(byInspect = false) {
  const key = `${state.x},${state.y}`, ev = F().events?.[key];
  if (!ev) {
    if (byInspect) {
      const d = DIRS[state.dir];
      say(isWall(state.x + d.dx, state.y + d.dy) ? "前方は壁。叩いても空洞音はない。" : "通路の奥から湿った風が来る。");
    }
    return false;
  }
  const done = `e_${state.floor}_${key}`;
  if (ev.once && state.flags[done]) { if (byInspect) say("ここにはもう何もない。"); return false; }
  if (ev.need && !state.flags[ev.need]) { say(ev.locked || "封印されている。"); return true; }
  switch (ev.type) {
    case "message": say(ev.text); break;
    case "trap": for (const p of living()) p.hp = Math.max(1, p.hp - ev.damage); say(ev.text); audio.hurt(); hurtT = 1; shakeT = 0.8; state.party.forEach((_, i) => partyCardHurt(i)); break;
    case "trapdoor": {
      audio.bump(); for (const p of living()) p.hp = Math.max(1, p.hp - ev.damage); say(ev.text); hurtT = 1;
      const to = Math.min(FLOORS.length - 1, state.floor + 1);
      if (to !== state.floor) setTimeout(() => changeFloor(to, true), 500);
      return true;
    }
    case "flag":
      state.flags[ev.flag] = true; say(ev.text); audio.coin();
      for (const r of world.runes) if (r.userData.cell === key) r.visible = false;
      break;
    case "rotate": {
      const nd = Math.floor(Math.random() * 4); audio.turn();
      spinT = 1; spinTarget = nd;
      say(`${ev.text} （向き：${DIRS[nd].n}）`);
      break;
    }
    case "dark": dark = ev.duration || 10; say(ev.text); audio.curse(); break;
    case "spelltrap": noSpell = ev.duration || 6; say(ev.text); audio.curse(); flash("rgba(120,60,200,.6)", 600); break;
    case "stairs": setTimeout(() => changeFloor(ev.to), 250); return true;
    case "chest": openChest(CHESTS[ev.table], done, key); return true;
    case "boss": setTimeout(() => startBattle("boss"), 400); return true;
  }
  if (ev.once) state.flags[done] = true;
  return false;
}

function changeFloor(to, fall = false) {
  busy = true; audio.stairs();
  const fade = $("fade"); fade.style.opacity = 1;
  setTimeout(() => {
    dark = 0; noSpell = 0;
    const from = state.floor;
    state.floor = to;
    const Fl = FLOORS[to];
    // 階段で移動した時は、戻り階段の上に出る
    const back = !fall && Object.entries(Fl.events || {}).find(([, e]) => e.type === "stairs" && e.to === from);
    if (back) { const [bx, by] = back[0].split(",").map(Number); state.x = bx; state.y = by; }
    else { state.x = Fl.start[0]; state.y = Fl.start[1]; }
    state.dir = Fl.start[2];
    for (let i = 0; i < 4; i++) { const d = DIRS[state.dir]; if (!isWall(state.x + d.dx, state.y + d.dy)) break; state.dir = (state.dir + 1) % 4; }
    state.danger = Math.max(0, state.danger - 20);
    buildFloor(to); placeCamera(); reveal(); renderHud(); audio.ambient(to);
    const key = `intro${to}`;
    if (Fl.intro && !state.flags[key]) { state.flags[key] = true; say(Fl.intro); } else say(`${Fl.name}へ進んだ。`);
    setTimeout(() => { fade.style.opacity = 0; busy = false; }, 150);
  }, 700);
}

// ================================================================
// 宝箱
// ================================================================
let chest = null;
function openChest(table, doneFlag = null, cell = null, prefix = "") {
  audio.chest(); mode = "modal";
  chest = { table, doneFlag, cell, trap: Math.random() * 100 < table.trap, prefix, inspected: false };
  showChest(`${prefix ? prefix + "\n" : ""}宝箱を見つけた。罠の気配がする。`);
}
function showChest(text) {
  modal(`<h2>宝箱</h2><p style="white-space:pre-line">${text}</p>
    <div class="acts"><button data-a="cInspect">罠を調べる</button><button data-a="cDisarm">罠を外す</button><button data-a="cOpen">開ける</button><button data-a="cLeave">立ち去る</button></div>`);
}
function chestAction(a) {
  const thief = state.party.find(p => p.cls === "thief" && p.hp > 0 && !p.dead);
  if (a === "cInspect") {
    const truth = Math.random() < (thief ? 0.72 + thief.lv * 0.025 : 0.35);
    showChest(truth ? (chest.trap ? `${thief ? thief.name : "隊列"}は罠を見抜いた。針と魔法線がある。` : "罠はないようだ。") : "判定に自信がない。何か見落としたかもしれない。");
  } else if (a === "cDisarm") {
    if (chest.trap && Math.random() > (thief ? 0.62 + thief.lv * 0.035 : 0.22)) { springTrap(); if (mode === "dead") return; showChest("罠が作動してしまった……。だが箱はまだ開けられる。"); }
    else { chest.trap = false; showChest("罠を外した。"); }
  } else if (a === "cOpen") {
    if (chest.trap) springTrap();
    if (mode === "dead") return;
    lootChest();
  } else if (a === "cLeave") { closeModal(); mode = "explore"; say("宝箱をそのままにした。"); chest = null; }
}
function springTrap() {
  const trap = choose(["毒針", "石弓", "爆裂", "ガス"]);
  const log = [`罠だ！ ${trap}が作動した。`];
  if (trap === "毒針") { const p = choose(living()); p.status.poison = 1; damageParty(p, rand(6, 14), log, "毒針"); }
  else if (trap === "ガス") { for (const p of living()) p.status.sleep = 2; log.push("眠りのガスが広がった。"); }
  else { for (const p of living()) damageParty(p, rand(5, 14), log, trap); if (trap === "爆裂") { flash("rgba(255,140,40,.7)", 500); shakeT = 1; } }
  chest.trap = false; audio.hurt(); hurtT = 1;
  say(log.join("\n")); renderHud();
  if (!living().length) gameOver();
}
function lootChest() {
  const t = chest.table, gold = rand(t.gold[0], t.gold[1]), got = [];
  state.gold += gold; audio.coin();
  if (t.item) { state.inventory[t.item] = (state.inventory[t.item] || 0) + 1; got.push(ITEMS[t.item].name); }
  if (t.equip && Math.random() < 0.55) { state.stock[t.equip] = (state.stock[t.equip] || 0) + 1; got.push(EQUIPMENT[t.equip].name); }
  if (t.cursedEquip && Math.random() * 100 < (t.cursedChance || 0)) {
    const ceq = EQUIPMENT[t.cursedEquip], victim = choose(living());
    if (victim) {
      const old = victim.equip[ceq.type]; if (old) state.stock[old] = (state.stock[old] || 0) + 1;
      victim.equip[ceq.type] = t.cursedEquip; victim.cursedSlot = ceq.type; got.push(`${ceq.name}（${victim.name}が呪縛された！）`);
    }
  }
  if (chest.doneFlag) state.flags[chest.doneFlag] = true;
  if (chest.cell && world.chests[chest.cell]) { world.chests[chest.cell].lidOpen = true; world.chests[chest.cell].shine.visible = false; }
  const at = chest.cell ? new THREE.Vector3(...[chest.cell.split(",")[0] * CELL, 0.7, chest.cell.split(",")[1] * CELL]) : camera.position.clone().add(new THREE.Vector3(0, -0.4, 0));
  burst(at, 60, 1.6, [1, 0.85, 0.4]);
  closeModal(); mode = "explore";
  say(`${chest.prefix ? chest.prefix + "\n" : ""}宝箱を開けた。${gold}ゴールド${got.length ? "と" + got.join("、") : ""}を得た。`);
  chest = null; renderHud();
}

// ================================================================
// 戦闘
// ================================================================
const foeLabels = $("foes");
function startBattle(forced = null) {
  if (mode !== "explore") return;
  mode = "battle";
  const id = forced || choose(F().monsters), m = MONSTERS[id];
  const count = forced === "boss" ? 1 : rand(m.group[0], m.group[1]);
  const ambush = m.skill === "ambush";
  const hasThief = state.party.some(p => p.cls === "thief" && p.hp > 0 && !p.dead);
  battle = {
    id, round: 1, boss: forced === "boss",
    surprise: Math.random() < (ambush ? (hasThief ? 0.35 : 0.72) : (hasThief ? 0.04 : 0.12)),
    enemies: Array.from({ length: count }, (_, i) => ({ ...m, key: `${id}_${i}`, maxHp: m.hp, hp: m.hp, sleep: 0, silence: 0, weak: 0 })),
    meshes: []
  };
  document.body.classList.add("inbattle");
  if (battle.boss) { audio.boss(); flash("rgba(160,0,0,.6)", 900); } else audio.encounter();
  spawnFoes();
  $("battleTitle").textContent = battle.boss ? m.name : `${m.name}　${count}体`;
  $("battleTitle").classList.remove("hidden");
  say(battle.boss ? BOSS_INTRO : `${m.name} ${count}体が現れた！${battle.surprise ? "\n不意を打たれた！" : ""}`);
  if (m.skill === "trap") {
    const log = [`${m.name}は宝箱に化けていた！罠が炸裂！`], dmg = Math.max(8, Math.floor(m.atk * 0.8));
    for (const p of living()) damageParty(p, dmg, log, `${m.name}の爆裂罠`);
    flash("rgba(255,140,40,.7)", 500); shakeT = 1;
    say(log.join("\n"), true); renderHud();
    if (!living().length) return gameOver();
  }
  if (battle.surprise) { busy = true; setTimeout(async () => { await enemyRound(); busy = false; showCommands(); }, 700); }
  else showCommands();
}
function liveEnemies() { return battle ? battle.enemies.filter(e => e.hp > 0) : []; }

// 敵を通路の前方に並べる（最大4体まで見せ、倒れたら奥の敵が前に出る）
function spawnFoes() {
  for (const mm of battle.meshes) scene.remove(mm.mesh);
  battle.meshes = [];
  foeLabels.innerHTML = "";
  const d = DIRS[state.dir], dist = battle.boss ? 2.15 : isWall(state.x + d.dx, state.y + d.dy) ? 1.35 : 2.5;
  const right = new THREE.Vector3(-d.dy, 0, d.dx);
  const fwd = new THREE.Vector3(d.dx, 0, d.dy);
  const show = liveEnemies().slice(0, battle.boss ? 1 : 4);
  const n = show.length;
  const size = battle.boss ? 2.0 : n >= 4 ? 1.15 : n === 3 ? 1.3 : 1.5;
  const spread = n === 1 ? [0] : n === 2 ? [-0.48, 0.48] : n === 3 ? [-0.68, 0, 0.68] : [-0.78, -0.26, 0.26, 0.78];
  show.forEach((e, i) => {
    const tex = monsterTexture(battle.id);
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0x000000, transparent: true, alphaTest: 0.35, roughness: 0.8, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    const base = new THREE.Vector3(state.x * CELL, 0, state.y * CELL).addScaledVector(fwd, dist + (i % 2) * 0.15).addScaledVector(right, spread[i]);
    mesh.position.set(base.x, size / 2 + 0.02, base.z);
    mesh.castShadow = true;
    mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.35 });
    scene.add(mesh);
    const label = document.createElement("div"); label.className = "foe";
    label.innerHTML = `<div class="fn">${e.name}</div><div class="bar"><i style="width:${e.hp / e.maxHp * 100}%"></i></div>`;
    foeLabels.appendChild(label);
    // 明るい色の敵が松明の光で白飛びしないよう、反射を少し抑える
    const tone = battle.boss ? 0.5 : MONSTER_ART[battle.id] ? 0.85 : 0.7;
    battle.meshes.push({ e, mesh, label, base: base.clone(), size, tone, flash: 0, dying: 0, lunge: 0, appear: 0, born: performance.now(), seed: Math.random() * 10 });
  });
}
function meshOf(e) { return battle?.meshes.find(m => m.e === e); }
function updateFoeLabels() {
  if (!battle) return;
  const tgt = liveEnemies()[0];
  for (const m of battle.meshes) {
    const top = m.mesh.position.clone(); top.y += m.size / 2 + 0.05;
    const p = top.project(camera);
    m.label.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`; m.label.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight}px`;
    m.label.style.opacity = m.e.hp > 0 ? 1 : 0;
    m.label.classList.toggle("tgt", m.e === tgt);
    m.label.querySelector("i").style.width = `${Math.max(0, m.e.hp / m.e.maxHp * 100)}%`;
  }
}

// 指示の窓
let menuSel = 0, menuItems = [];
function setMenu(el, items) {
  menuItems = items; menuSel = 0;
  el.innerHTML = items.map((it, i) => `<button data-i="${i}" ${it.disabled ? "disabled" : ""}>${it.label}${it.key ? `<span class="key">${it.key}</span>` : ""}</button>`).join("");
  el.querySelectorAll("button").forEach(b => b.addEventListener("click", () => { audio.init(); const it = items[+b.dataset.i]; if (!it.disabled) it.run(); }));
  highlightMenu(el);
}
function highlightMenu(el) { el.querySelectorAll("button").forEach((b, i) => b.classList.toggle("sel", i === menuSel)); }
function activeMenuEl() { return !$("sub").classList.contains("hidden") ? $("sub") : $("cmd"); }
function showCommands() {
  if (mode !== "battle") return;
  $("sub").classList.add("hidden"); $("cmd").classList.remove("hidden"); $("touch").classList.add("hidden");
  const mageCaster = living().find(p => ["mage", "bishop"].includes(CLASSES[p.cls]?.spell) && p.mp.some(v => v > 0));
  const priestCaster = living().find(p => ["priest", "bishop"].includes(CLASSES[p.cls]?.spell) && p.mp.some(v => v > 0));
  setMenu($("cmd"), [
    { label: "攻撃", key: "Z", run: () => playerRound("attack") },
    { label: "呪文", key: "1", disabled: !mageCaster || noSpell > 0, run: showSpells },
    { label: "祈り", key: "2", disabled: !priestCaster || noSpell > 0, run: () => playerRound("pray") },
    { label: "防御", key: "3", run: () => playerRound("defend") },
    { label: "道具", key: "4", run: showItems },
    { label: battle.boss ? "退けない" : "退く", key: "Esc", disabled: battle.boss, run: () => playerRound("run") }
  ]);
}
function showSpells() {
  const caster = living().find(p => ["mage", "bishop"].includes(CLASSES[p.cls]?.spell) && p.mp.some(v => v > 0));
  $("sub").classList.remove("hidden");
  setMenu($("sub"), [...SPELLS.mage.map(s => ({ label: `${s.name}（${s.text}）　残${caster.mp[s.lv - 1]}`, disabled: caster.mp[s.lv - 1] <= 0, run: () => playerRound("cast", s.id) })),
    { label: "やめる", run: showCommands }]);
}
function showItems() {
  $("sub").classList.remove("hidden");
  const list = Object.entries(ITEMS).filter(([id]) => id !== "malorScroll" && (state.inventory[id] || 0) > 0);
  setMenu($("sub"), [...list.map(([id, it]) => ({ label: `${it.name}　×${state.inventory[id]}`, run: () => playerRound("item", id) })), { label: "やめる", run: showCommands }]);
}
function hideCommands() { $("cmd").classList.add("hidden"); $("sub").classList.add("hidden"); }

// 1行ずつ文と演出を流す
async function play(log) {
  for (const entry of log) {
    if (typeof entry === "function") { entry(); continue; }
    say(entry, true); await sleep(330);
  }
}

async function playerRound(action, arg = null) {
  if (mode !== "battle" || busy) return;
  busy = true; hideCommands(); say("");
  const log = [];
  wakeAndPoison();
  if (action === "defend") { state.party.forEach(p => p.guard = p.hp > 0 ? 1 : 0); log.push("隊列は防御の構えを取った。", () => audio.turn()); }
  else if (action === "cast") castMage(arg, log);
  else if (action === "pray") pray(log);
  else if (action === "item") useItemIn(arg, log);
  else if (action === "run") {
    const avgAgi = living().reduce((s, p) => s + p.agi, 0) / Math.max(1, living().length);
    if (Math.random() < 0.48 + avgAgi / 90) { await play(["隊列は闇の中へ退いた。"]); endBattle(); busy = false; return; }
    log.push("退こうとしたが、回り込まれた！");
  } else attackRound(log);
  await play(log);
  renderHud(); updateFoeLabels();
  if (!liveEnemies().length) { await victory(); busy = false; return; }
  // 倒れた敵の後ろから次の敵が前に出る
  if (battle.meshes.every(m => m.e.hp <= 0) && liveEnemies().length) { await sleep(500); spawnFoes(); say("奥から次の敵が進み出る！", true); await sleep(400); }
  await enemyRound();
  busy = false;
  if (mode === "battle") showCommands();
}

function wakeAndPoison() {
  for (const p of state.party) {
    p.guard = 0; if (p.hp <= 0) continue;
    if (p.status.sleep) { p.status.sleep -= 1; if (p.status.sleep <= 0) delete p.status.sleep; }
    if (p.status.poison) p.hp = Math.max(1, p.hp - 3);
  }
}

function attackRound(log) {
  const actors = living().sort((a, b) => b.agi - a.agi);
  for (const p of actors) {
    const e = liveEnemies()[0]; if (!e) break;
    if (p.status.sleep) { log.push(`${p.name}は眠っている。`); continue; }
    if (p.status.paralyze) { log.push(`${p.name}は痺れて動けない。`); continue; }
    const row = state.party.indexOf(p) < 3 ? "front" : "back";
    if (!(row === "front" || CLASSES[p.cls]?.spell || CLASSES[p.cls]?.ranged)) { log.push(`${p.name}は後列から届かない。`); continue; }
    if (Math.random() >= hitRate(p.agi + p.lv * 2, e.ac)) { log.push(() => audio.miss(), `${p.name}の攻撃は外れた。`); continue; }
    if (e.skill === "guard" && Math.random() < 0.22) { log.push(() => audio.miss(), `${p.name}の攻撃を${e.name}は盾で弾いた。`); continue; }
    const crit = (p.cls === "samurai" && Math.random() < 0.08 + p.lv * 0.01) || (p.cls === "ninja" && Math.random() < 0.06);
    const dmg = crit && !battle.boss ? e.hp : Math.max(1, atkOf(p) + rand(1, 6) + Math.floor(p.lv * 1.6) - Math.max(-2, e.ac)) * (crit ? 2 : 1);
    e.hp = Math.max(0, e.hp - dmg);
    const dead = e.hp <= 0;
    log.push(() => fxHit(e, dmg, crit), `${p.name}の攻撃。${e.name}に${dmg}の傷${crit ? "。会心の一撃！" : "。"}`);
    if (dead) log.push(() => fxDie(e), `${e.name}を倒した。`);
  }
}

function castMage(spellId, log) {
  if (noSpell > 0) { log.push("魔封じの間では呪文が使えない。"); return; }
  const caster = living().find(p => ["mage", "bishop"].includes(CLASSES[p.cls]?.spell) && p.mp.some(v => v > 0));
  if (!caster) { log.push("唱えられる者がいない。"); return; }
  const spell = SPELLS.mage.find(s => s.id === spellId && caster.mp[s.lv - 1] > 0);
  if (!spell) { log.push("呪文回数が尽きている。"); return; }
  caster.mp[spell.lv - 1] -= 1;
  applySpell(caster, spell, log);
}
function pray(log) {
  if (noSpell > 0) { log.push("魔封じの間では祈りも届かない。"); return; }
  const caster = living().find(p => ["priest", "bishop"].includes(CLASSES[p.cls]?.spell) && p.mp.some(v => v > 0));
  if (!caster) { log.push("祈れる者がいない。"); return; }
  const wounded = living().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  const spell = caster.mp[2] > 0 && wounded.hp < wounded.maxHp * 0.35 ? SPELLS.priest[4]
    : caster.mp[1] > 0 && state.party.some(p => p.status.poison || p.status.paralyze) ? SPELLS.priest[3]
    : wounded.hp < wounded.maxHp * 0.85 ? SPELLS.priest.find(s => s.id === "dios") : SPELLS.priest.find(s => s.id === "badios");
  if (!spell || caster.mp[spell.lv - 1] <= 0) { log.push("祈りの力が残っていない。"); return; }
  caster.mp[spell.lv - 1] -= 1;
  applySpell(caster, spell, log);
}
function applySpell(caster, spell, log) {
  if (spell.kind === "heal" || spell.kind === "fullheal") {
    const t = living().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] || caster;
    const heal = spell.kind === "fullheal" ? t.maxHp : spell.power + caster.pie + rand(0, 8);
    t.hp = Math.min(t.maxHp, t.hp + heal);
    for (const k of ["poison", "paralyze", "bleed", "burn", "slow"]) delete t.status[k];
    log.push(() => fxHeal(t), `${caster.name}は${spell.name}を唱えた。${t.name}の傷が癒えた。`);
    return;
  }
  if (spell.kind === "cure") {
    state.party.forEach(p => { for (const k of ["poison", "paralyze", "bleed", "burn", "slow"]) delete p.status[k]; });
    log.push(() => fxHeal(null), `${caster.name}は${spell.name}を唱えた。毒と麻痺が消えた。`);
    return;
  }
  const targets = spell.target === "one" ? liveEnemies().slice(0, 1) : liveEnemies();
  if (spell.kind === "damage") {
    const holy = spell.id === "badios";
    log.push(() => fxSpell(targets, holy ? "holy" : "fire"), `${caster.name}は${spell.name}を唱えた！`);
    for (const e of targets) {
      const dmg = Math.max(3, spell.power + Math.floor((holy ? caster.pie : caster.int) * 1.2) + rand(-5, 8) - Math.max(0, e.ac));
      e.hp = Math.max(0, e.hp - dmg);
      const dead = e.hp <= 0;
      log.push(() => fxHit(e, dmg, false, true), `${e.name}に${dmg}の傷。`);
      if (dead) log.push(() => fxDie(e), `${e.name}は${holy ? "光に焼かれて" : "炎に包まれて"}崩れ落ちた。`);
    }
  }
  if (spell.kind === "sleep") { for (const e of targets) if (Math.random() < 0.55) e.sleep = 2; log.push(() => fxSpell(targets, "sleep"), `${caster.name}は${spell.name}を唱えた。眠りの霧が広がる。`); }
  if (spell.kind === "weaken") { for (const e of targets) e.weak += 2; log.push(() => fxSpell(targets, "sleep"), `${caster.name}は${spell.name}を唱えた。敵の姿が揺らいだ。`); }
  if (spell.kind === "silence") { for (const e of targets) if (Math.random() < 0.5) e.silence = 3; log.push(() => fxSpell(targets, "sleep"), `${caster.name}は${spell.name}を唱えた。敵の呪文を封じた。`); }
}
function useItemIn(id, log) {
  if ((state.inventory[id] || 0) <= 0) { log.push("その道具はない。"); return; }
  state.inventory[id] -= 1;
  const t = living().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] || state.party[0];
  if (id === "potion") { t.hp = Math.min(t.maxHp, t.hp + 45); log.push(() => fxHeal(t), `${ITEMS[id].name}を使った。${t.name}の傷が癒えた。`); return; }
  if (id === "ether") { const c = state.party.find(p => p.maxMp?.some(v => v > 0) && !p.dead); if (c) c.mp = c.mp.map((v, i) => Math.min(c.maxMp[i], v + 1)); log.push(() => fxHeal(null), `${ITEMS[id].name}を焚いた。呪文の力が戻る。`); return; }
  if (id === "antidote") { state.party.forEach(p => delete p.status.poison); log.push(() => fxHeal(null), "毒消しを使った。毒が抜けた。"); return; }
  if (id === "stoneCure") { state.party.forEach(p => delete p.status.paralyze); log.push(() => fxHeal(null), "石化解きを使った。体の強張りが解けた。"); return; }
}

async function enemyRound() {
  const log = [];
  for (const e of liveEnemies()) {
    if (e.sleep) { e.sleep -= 1; log.push(`${e.name}は眠っている。`); continue; }
    const pool = frontRow().length ? frontRow() : living();
    const target = choose(pool); if (!target) break;
    if (e.skill === "breath" && Math.random() < 0.28) {
      const dmg = Math.max(5, Math.floor(e.atk * 0.65));
      log.push(() => { fxLunge(e); flash("rgba(255,120,30,.6)", 600); audio.fire(); shakeT = 1; }, `${e.name}が炎の息を吐いた！`);
      for (const p of living()) damageParty(p, dmg, log, `${e.name}のブレス`);
      continue;
    }
    if (e.skill === "curse" && !e.silence && Math.random() < 0.28) {
      const v = choose(living()); v.status.paralyze = 1;
      log.push(() => { audio.curse(); flash("rgba(110,40,180,.55)", 600); }, `${e.name}の呪い。${v.name}は麻痺した。`);
      continue;
    }
    if (e.skill === "hero" && Math.random() < 0.32) {
      log.push(() => { fxLunge(e); audio.boss(); }, `${e.name}の怒涛の連撃！`);
      for (let h = 0; h < 3; h++) { const t = choose(frontRow().length ? frontRow() : living()); if (!t) break; damageParty(t, Math.max(1, e.dice + rand(1, 6) - Math.floor(acOf(t) / 2)), log, `${e.name}の連撃`); }
      continue;
    }
    if (Math.random() >= hitRate(e.atk, acOf(target))) { log.push(() => { fxLunge(e); audio.miss(); }, `${e.name}の攻撃は外れた。`); continue; }
    let dmg = Math.max(1, e.dice + rand(1, 8) - Math.floor(acOf(target) / 2) - (e.weak || 0));
    if (e.skill === "slam" && Math.random() < 0.25) dmg = Math.floor(dmg * 1.7);
    log.push(() => fxLunge(e));
    damageParty(target, dmg, log, `${e.name}の攻撃`);
    if (e.skill === "poison" && target.hp > 0 && Math.random() < 0.35) { target.status.poison = 1; log.push(`${target.name}は毒を受けた。`); }
    if (e.skill === "drain" && target.hp > 0 && Math.random() < 0.25) {
      e.hp = Math.min(e.maxHp, e.hp + Math.floor(dmg / 2)); log.push(`${e.name}は生命力を吸った。`);
      if (target.lv > 1 && Math.random() < 0.2) { target.lv--; target.exp = 0; target.maxHp = Math.max(1, target.maxHp - rand(2, 5)); target.hp = Math.min(target.hp, target.maxHp); log.push(() => audio.curse(), `${target.name}はレベルを奪われた！（レベル${target.lv}）`); }
    }
    if (e.skill === "mirror" && Math.random() < 0.35) { const r = choose(living()); if (r) damageParty(r, Math.max(1, Math.floor(dmg * 0.5)), log, `${e.name}の反射`); }
    if (e.skill === "bleed" && target.hp > 0 && Math.random() < 0.3) { target.status.bleed = 1; log.push(`${target.name}は出血した。`); }
    if (e.skill === "burn" && target.hp > 0 && Math.random() < 0.3) { target.status.burn = 1; log.push(`${target.name}は炎上した。`); }
    if (e.skill === "freeze" && target.hp > 0 && Math.random() < 0.25) { target.status.paralyze = 1; log.push(`${target.name}は凍りついた。`); }
    if (e.skill === "slow" && target.hp > 0 && Math.random() < 0.3) { target.status.slow = 1; log.push(`${target.name}は鈍化した。`); }
    if (e.skill === "acid" && target.hp > 0 && Math.random() < 0.25) { target.status.poison = 1; log.push(`${target.name}は酸を浴びた。`); }
  }
  await play(log);
  renderHud();
  if (!living().length) return gameOver();
  if (battle) battle.round++;
}

function damageParty(p, amount, log, source) {
  const dmg = Math.max(1, Math.floor(amount * (p.guard ? 0.45 : 1)));
  p.hp = Math.max(0, p.hp - dmg);
  const i = state.party.indexOf(p);
  log.push(() => { audio.hurt(); hurtT = Math.min(1, hurtT + 0.6); shakeT = Math.max(shakeT, 0.7); partyCardHurt(i); renderParty(); }, `${source}。${p.name}に${dmg}の傷。`);
  if (p.hp <= 0 && !p.dead) {
    const brutal = dmg >= p.maxHp * 0.75 || source.includes("連撃") || source.includes("ブレス");
    p.dead = brutal && Math.random() < 0.28 ? "ashes" : "dead";
    log.push(p.dead === "ashes" ? `${p.name}の遺体は灰と化した……` : `${p.name}は倒れた。`);
  }
}

function levelUp(p, log) {
  while (p.exp >= p.lv * 85) {
    p.exp -= p.lv * 85; p.lv++;
    p.maxHp += rand(5, 10) + (p.cls === "fighter" ? 4 : 0); p.hp = p.maxHp;
    p.atk += p.cls === "mage" ? 1 : 2;
    p.baseAc = Math.max(-4, p.baseAc - (p.cls === "fighter" ? 1 : 0));
    p.int += p.cls === "mage" ? 2 : 1; p.pie += p.cls === "priest" ? 2 : 1; p.agi += p.cls === "thief" ? 2 : 1;
    if (CLASSES[p.cls]?.spell) { p.maxMp = p.maxMp.map((v, i) => v + (p.lv > i * 3 ? 1 : 0)); p.mp = [...p.maxMp]; }
    log.push(() => audio.levelup(), `${p.name}はレベル${p.lv}になった！`);
  }
}

async function victory() {
  const exp = battle.enemies.reduce((s, e) => s + e.exp, 0);
  const gold = battle.enemies.reduce((s, e) => s + e.gold, 0) + rand(0, 40);
  if (battle.boss) {
    audio.victory();
    await play(["腐敗した勇者アレックスは玉座の前に崩れ落ちた。玉座の間に、六人の足音だけが残る。"]);
    await sleep(1600);
    endBattle(); mode = "ending";
    modal(`${ENDING_HTML}<div class="acts"><button data-a="newGame">もう一度</button><button data-a="toTitle">表題へ</button></div>`);
    return;
  }
  audio.victory();
  state.gold += gold;
  const log = [];
  for (const p of living()) { p.exp += exp; levelUp(p, log); }
  log.unshift(`勝利。経験値${exp}と${gold}ゴールドを得た。`);
  await play(log);
  renderHud();
  const hasChest = Math.random() < 0.45;
  await sleep(500);
  endBattle();
  if (hasChest) openChest(CHESTS.battle, null, null, "敵の残した宝箱がある。");
}
function endBattle() {
  if (battle) for (const m of battle.meshes) scene.remove(m.mesh);
  battle = null; foeLabels.innerHTML = ""; document.body.classList.remove("inbattle");
  hideCommands(); $("battleTitle").classList.add("hidden"); $("touch").classList.remove("hidden");
  state.party.forEach(p => p.guard = 0);
  if (mode === "battle") mode = "explore";
  renderHud();
}
function gameOver() {
  busy = false; endBattle(); mode = "dead";
  audio.curse();
  modal(`<h1 class="red">全滅</h1><p>六人の灯は闇に呑まれた。寺院に運び込む者もいない。</p>
    <div class="acts"><button data-a="load">記録から再開</button><button data-a="toTitle">表題へ</button></div>`);
}

// ---- 戦闘の演出 ----
function fxHit(e, dmg, crit, magic = false) {
  const m = meshOf(e); if (!m) return;
  m.flash = 1; shakeT = Math.max(shakeT, crit ? 1 : 0.45);
  const at = m.mesh.position.clone();
  burst(at, crit ? 140 : 60, crit ? 4.5 : 3, magic ? [1, 0.55, 0.2] : [1, 0.85, 0.55]);
  popAt(at.clone().add(new THREE.Vector3(0, m.size * 0.2, 0)), crit ? `${dmg}!` : `${dmg}`, crit ? "#ffe066" : "#fff2c0", crit ? 44 : 34);
  crit ? audio.crit() : audio.hit();
  if (crit) flash("rgba(255,240,200,.45)", 200);
}
function fxDie(e) { const m = meshOf(e); if (!m) return; m.dying = 1; burst(m.mesh.position, 160, 2.2, [0.9, 0.7, 0.5], 0.5, 0.2); }
function fxLunge(e) { const m = meshOf(e); if (m) m.lunge = 1; }
function fxHeal(p) {
  audio.heal(); flash("rgba(120,255,170,.35)", 600);
  if (p) { const i = state.party.indexOf(p); const el = $("pm" + i); el?.animate([{ boxShadow: "0 0 0 2px #58ff9a" }, { boxShadow: "0 0 0 0 transparent" }], { duration: 900 }); }
  burst(camera.position.clone().add(new THREE.Vector3(0, -0.5, 0)).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(1.2)), 70, 1.2, [0.4, 1, 0.6], 1.2, 0.2);
  renderParty();
}
function fxSpell(targets, kind) {
  const cols = { fire: [1, 0.5, 0.15], holy: [1, 0.95, 0.7], sleep: [0.5, 0.7, 1] };
  const lightCol = { fire: 0xff6a20, holy: 0xfff0c0, sleep: 0x6aa0ff };
  if (kind === "fire") audio.fire(); else audio.spell();
  const center = targets.length ? meshOf(targets[0])?.mesh.position.clone() : null;
  if (center) { spellLight.color.setHex(lightCol[kind]); spellLight.position.copy(center).add(new THREE.Vector3(0, 0.5, 0)); spellLight.intensity = 40; }
  for (const e of targets) { const m = meshOf(e); if (m) burst(m.mesh.position, kind === "fire" ? 110 : 70, kind === "fire" ? 2.6 : 1.4, cols[kind], 1.4, kind === "fire" ? 0.15 : 0.1); }
  flash(kind === "fire" ? "rgba(255,120,40,.4)" : kind === "holy" ? "rgba(255,250,220,.45)" : "rgba(100,140,255,.35)", 500);
}

// ================================================================
// 窓（野営・町・宝箱・表題）
// ================================================================
function modal(html) { $("modalBox").innerHTML = html; $("modal").classList.remove("hidden"); }
function closeModal() { $("modal").classList.add("hidden"); }
$("modalBox").addEventListener("click", e => { const b = e.target.closest("button[data-a]"); if (b) { audio.init(); action(b.dataset.a, b.dataset.v); } });

function campMenu(note = "") {
  if (mode !== "explore") return;
  mode = "modal";
  const atEntrance = state.floor === 0 && state.x === FLOORS[0].start[0] && state.y === FLOORS[0].start[1];
  const rows = state.party.map(p => `<div class="dim">${p.name}（${p.className}・レベル${p.lv}）体力 ${p.hp}/${p.maxHp}　防御${acOf(p)}　攻撃${atkOf(p)}${p.maxMp.some(v => v) ? `　呪文${p.mp.join("/")}` : ""}${p.dead ? `　<span class="red">${p.dead === "ashes" ? "灰" : p.dead === "lost" ? "消失" : "死亡"}</span>` : ""}　経験${p.exp}/${p.lv * 85}</div>`).join("");
  const items = Object.entries(ITEMS).filter(([id]) => (state.inventory[id] || 0) > 0)
    .map(([id, it]) => `<button data-a="useItem" data-v="${id}">${it.name}×${state.inventory[id]}</button>`).join("");
  modal(`<h2>野営</h2>${note ? `<p class="gold">${note}</p>` : ""}${rows}
    <p>所持金 ${state.gold}ゴールド</p>
    <div class="acts">${items || '<span class="dim">道具はない</span>'}</div>
    <div class="acts">
      ${atEntrance ? '<button data-a="town">町へ入る</button>' : ""}
      <button data-a="equipBest">装備を整える</button>
      <button data-a="swapRow">隊列を入れ替える</button>
      <button data-a="save">記録する</button>
      <button data-a="close">閉じる</button>
    </div>`);
}
function town(note = "") {
  mode = "modal";
  const innCost = 30 + state.party.reduce((s, p) => s + p.lv * 8, 0);
  const shop = Object.entries(ITEMS).map(([id, it]) => `<button data-a="buyItem" data-v="${id}">${it.name}　${it.price}</button>`).join("");
  const arms = Object.entries(EQUIPMENT).filter(([id, e]) => !e.cursed && id !== "muramasaShard").map(([id, e]) => `<button data-a="buyEquip" data-v="${id}">${e.name}　${e.price}</button>`).join("");
  modal(`<h2>入口の町</h2>${note ? `<p class="gold" style="white-space:pre-line">${note}</p>` : ""}<p>所持金 ${state.gold}ゴールド</p>
    <div class="acts"><button data-a="inn">宿屋で休む（${innCost}）</button><button data-a="temple">寺院で蘇生</button><button data-a="decurse">寺院で呪い解き</button></div>
    <p class="dim">道具屋</p><div class="grid">${shop}</div>
    <p class="dim">武具屋（買った品は「装備を整える」で身につける）</p><div class="grid">${arms}</div>
    <div class="acts"><button data-a="equipBest">装備を整える</button><button data-a="save">記録する</button><button data-a="close">迷宮へ戻る</button></div>`);
}
function action(a, v) {
  if (a.startsWith("c") && chest && ["cInspect", "cDisarm", "cOpen", "cLeave"].includes(a)) return chestAction(a);
  switch (a) {
    case "close": closeModal(); mode = "explore"; renderHud(); break;
    case "newGame": closeModal(); startNew(); break;
    case "toTitle": closeModal(); showTitle(); break;
    case "load": closeModal(); if (!loadGame()) { showTitle(); } break;
    case "save": saveGame(); campOrTown("冒険の記録を残した。"); break;
    case "useItem": {
      if (v === "malorScroll") {
        state.inventory[v]--; closeModal(); mode = "explore";
        const s = FLOORS[0].start; state.floor = 0; state.x = s[0]; state.y = s[1]; state.dir = s[2];
        buildFloor(0); placeCamera(); reveal(); renderHud(); audio.ambient(0); audio.spell(); flash("rgba(200,220,255,.7)", 900);
        town("巻物の光に包まれ、入口へ戻った。"); break;
      }
      const log = []; useItemIn(v, log);
      for (const l of log) if (typeof l === "function") l(); else say(l);
      renderHud(); mode = "explore"; campMenu(log.filter(l => typeof l === "string").join(" ")); break;
    }
    case "equipBest": equipBest(); campOrTown("可能な限り良い装備に持ち替えた。"); break;
    case "swapRow": { const p = state.party.splice(0, 1)[0]; state.party.splice(3, 0, p); renderHud(); campOrTown(`${p.name}が後列へ下がった。`); break; }
    case "town": town(); break;
    case "inn": {
      const cost = 30 + state.party.reduce((s, p) => s + p.lv * 8, 0);
      if (state.gold < cost) { town(`宿代は${cost}ゴールド。足りない。`); break; }
      state.gold -= cost; state.party.forEach(p => { if (p.hp > 0 && !p.dead) { p.hp = p.maxHp; p.mp = [...p.maxMp]; delete p.status.sleep; } });
      audio.heal(); renderHud(); town(`馬小屋で休んだ。${cost}ゴールド支払った。`); break;
    }
    case "temple": town(temple()); renderHud(); break;
    case "decurse": town(decurse()); renderHud(); break;
    case "buyItem": case "buyEquip": {
      const data = a === "buyItem" ? ITEMS[v] : EQUIPMENT[v];
      if (state.gold < data.price) { town("金が足りない。"); break; }
      state.gold -= data.price; audio.coin();
      if (a === "buyItem") state.inventory[v] = (state.inventory[v] || 0) + 1; else state.stock[v] = (state.stock[v] || 0) + 1;
      town(`${data.name}を買った。`); break;
    }
  }
}
function campOrTown(note) { if ($("modalBox").innerHTML.includes("入口の町")) town(note); else { mode = "explore"; campMenu(note); } }
function equipBest() {
  for (const p of state.party) for (const [id, count] of Object.entries(state.stock)) {
    if (count <= 0) continue; const e = EQUIPMENT[id]; if (!e) continue;
    const slot = e.type; if (p.cursedSlot === slot) continue;
    const cur = p.equip[slot];
    const better = slot === "weapon" ? e.atk > (EQUIPMENT[cur]?.atk || 0) : e.ac < (EQUIPMENT[cur]?.ac || 0);
    if (better) { if (cur) state.stock[cur] = (state.stock[cur] || 0) + 1; p.equip[slot] = id; state.stock[id]--; }
  }
}
function temple() {
  const cands = state.party.filter(p => p.dead && p.dead !== "lost");
  if (!cands.length) { const lost = state.party.filter(p => p.dead === "lost"); return lost.length ? `${lost.map(p => p.name).join("、")}は永遠に失われた。いかなる奇跡も届かぬ。` : "蘇生を待つ者はいない。"; }
  const t = cands[0], ashes = t.dead === "ashes", cost = ashes ? 500 + t.lv * 150 : 250 + t.lv * 80;
  if (state.gold < cost) return `${t.name}（${ashes ? "灰" : "死亡"}）の蘇生には${cost}ゴールド必要だ。`;
  state.gold -= cost;
  if (Math.random() < (ashes ? Math.max(0.3, 0.6 - t.lv * 0.025) : Math.max(0.55, 0.85 - t.lv * 0.015))) {
    t.hp = Math.max(1, Math.floor(t.maxHp / 2)); t.status = {}; t.dead = undefined; audio.heal();
    if (ashes) { const o = t.lv; t.lv = Math.max(1, t.lv - 1); t.maxHp = Math.max(1, t.maxHp - rand(1, 4)); return `${t.name}は灰の中から蘇った。${cost}ゴールドを献金した。\nただし力は衰え、レベル${o}→${t.lv}に落ちた。`; }
    return `${t.name}は蘇生した。${cost}ゴールドを献金した。`;
  }
  if (ashes) { t.dead = "lost"; return `${t.name}の蘇生は失敗した。魂は完全に消え去った……`; }
  t.dead = "ashes"; return `${t.name}の蘇生は失敗した。遺体は灰と化した……再度の儀式が必要だ。`;
}
function decurse() {
  const c = state.party.find(p => p.cursedSlot); if (!c) return "呪われた者はいない。";
  const cost = 600 + c.lv * 100; if (state.gold < cost) return `呪い解きには${cost}ゴールド必要だ。`;
  state.gold -= cost; const slot = c.cursedSlot, id = c.equip[slot]; c.equip[slot] = null; c.cursedSlot = undefined;
  return `${c.name}の呪いが解けた。${EQUIPMENT[id]?.name || "装備"}が砕けた。${cost}ゴールドを献金した。`;
}

// ================================================================
// 記録
// ================================================================
function saveGame() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch {} }
function loadGame() {
  let s = null; try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch {}
  if (!s || !s.party) return false;
  state = s; enterGame("冒険の記録を読み込んだ。"); return true;
}
function startNew() { state = newState(); enterGame(PROLOGUE); }
function enterGame(text) {
  $("title").classList.add("hidden");
  dark = 0; noSpell = 0; battle = null; busy = false; mode = "explore";
  buildFloor(state.floor); placeCamera(); reveal(); renderHud(); audio.ambient(state.floor);
  say(text);
  $("fade").style.opacity = 0;
}
function showTitle() {
  mode = "title"; endBattle(); mode = "title";
  $("title").classList.remove("hidden");
}
$("title").style.backgroundImage = "url(img/title.png)";
$("btnNew").addEventListener("click", () => { audio.init(); startNew(); });
$("btnLoad").addEventListener("click", () => { audio.init(); if (!loadGame()) { $("btnLoad").textContent = "記録がない"; setTimeout(() => $("btnLoad").textContent = "続きから", 1500); } });

// ================================================================
// 操作
// ================================================================
function act(c) {
  audio.init();
  if (mode === "battle") {
    if (busy) return;
    const el = activeMenuEl();
    if (c === "attack" || c === "ok") { if (el === $("cmd") && c === "attack") return playerRound("attack"); const b = el.querySelectorAll("button")[menuSel]; if (b && !b.disabled) b.click(); return; }
    if (c === "up" || c === "down") { const n = menuItems.length; menuSel = (menuSel + (c === "up" ? n - 1 : 1)) % n; highlightMenu(el); return; }
    if (c === "cancel") { if (el === $("sub")) showCommands(); else if (!battle.boss) playerRound("run"); return; }
    if (/^n[1-4]$/.test(c) && el === $("cmd")) { const b = el.querySelectorAll("button")[+c[1]]; if (b && !b.disabled) b.click(); }
    return;
  }
  if (mode === "modal" || mode === "dead" || mode === "ending") { if (c === "cancel" && mode === "modal" && !chest) action("close"); return; }
  if (mode !== "explore" || busy || spinT > 0) return;
  if (anim.t < 1) { if ((performance.now() - anim.start) / 1000 < anim.dur) return; finishAnim(); }
  if (c === "left" || c === "right" || c === "turn") { audio.turn(); turnTo((state.dir + (c === "left" ? 3 : c === "right" ? 1 : 2)) % 4, c === "turn" ? 0.34 : 0.2); renderHud(); return; }
  if (c === "forward" || c === "up") return moveForward();
  if (c === "ok" || c === "attack") { const t = handleEvent(true); renderHud(); return t; }
  if (c === "camp" || c === "cancel") return campMenu();
  if (c === "map") return toggleMap();
}
addEventListener("keydown", e => {
  if (mode === "title") { if (e.code === "Enter" || e.code === "Space" || e.code === "KeyZ") { audio.init(); startNew(); } return; }
  if (!$("mapBig").classList.contains("hidden") && (e.code === "KeyM" || e.code === "Escape")) { toggleMap(); return; }
  const inBattle = mode === "battle";
  const map = {
    KeyW: "forward", ArrowUp: inBattle ? "up" : "forward", ArrowDown: inBattle ? "down" : "turn", KeyS: inBattle ? "down" : null,
    KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right", KeyX: "turn",
    KeyZ: "attack", Enter: "ok", Space: "ok", Numpad1: "ok", Escape: "cancel", Numpad2: "cancel", KeyC: "camp", KeyM: "map",
    Digit1: "n1", Digit2: "n2", Digit3: "n3", Digit4: "n4"
  };
  const c = map[e.code]; if (c) { e.preventDefault(); act(c); }
});
document.querySelectorAll("#touch button").forEach(b => b.addEventListener("pointerdown", e => { e.preventDefault(); act(b.dataset.c); }));

// ================================================================
// 毎フレーム
// ================================================================
let hurtT = 0, shakeT = 0, bumpT = 0, spinT = 0, spinTarget = 0;
const clock = new THREE.Clock();
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const perf = { frames: 0, t0: 0, lowered: false };
function lowerQuality() {
  perf.lowered = true; renderer.shadowMap.enabled = false; torchLight.castShadow = false;
  renderer.setPixelRatio(1); composer.setSize(innerWidth, innerHeight);
  scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
}
function tick() {
  const dt = Math.min(0.05, clock.getDelta()), time = clock.elapsedTime;
  if (anim.t < 1) {
    anim.t = Math.min(1, (performance.now() - anim.start) / 1000 / anim.dur);
    const k = ease(anim.t);
    camera.position.lerpVectors(anim.from, anim.to, k);
    camera.rotation.y = anim.yaw0 + (anim.yaw1 - anim.yaw0) * k;
    camera.position.y = EYE + (anim.from.distanceToSquared(anim.to) > 0.01 ? Math.sin(k * Math.PI) * 0.06 : 0);
    if (anim.t >= 1) camera.rotation.y = yawOf(state?.dir || 0);
  }
  // 回転床：一回転半してから新しい向きで止まる
  if (spinT > 0) {
    spinT = Math.max(0, spinT - dt * 1.2);
    camera.rotation.y = yawOf(spinTarget) + spinT * Math.PI * 3;
    if (spinT === 0) { state.dir = spinTarget; camera.rotation.y = yawOf(spinTarget); renderHud(); }
  }
  const base = mode === "battle" ? (battle ? anim.to : camera.position) : anim.to;
  if (shakeT > 0) {
    camera.position.x = base.x + (Math.random() - 0.5) * 0.07 * shakeT;
    camera.position.y = EYE + (Math.random() - 0.5) * 0.05 * shakeT;
    shakeT = Math.max(0, shakeT - dt * 3);
    if (shakeT === 0) { camera.position.x = base.x; camera.position.y = EYE; }
  }
  if (bumpT > 0) { camera.position.x = anim.to.x + (Math.random() - 0.5) * 0.03 * bumpT; bumpT = Math.max(0, bumpT - dt * 4); if (bumpT === 0) camera.position.x = anim.to.x; }

  // 松明（暗闇の罠ではほとんど消える）
  const tTarget = dark > 0 ? 1.4 : 9;
  torchLight.intensity += (tTarget + Math.sin(time * 9.1) * 0.7 + Math.sin(time * 23.7) * 0.45 + (Math.random() - 0.5) * 0.5 - torchLight.intensity) * Math.min(1, dt * 6);
  scene.fog.density += ((dark > 0 ? 0.32 : 0.11) - scene.fog.density) * Math.min(1, dt * 3);
  spellLight.intensity = Math.max(0, spellLight.intensity - dt * 70);

  if (world) {
    for (const f of world.flames) {
      const k = 1 + Math.sin(time * 11 + f.seed) * 0.12 + (Math.random() - 0.5) * 0.08;
      f.fl.scale.set(0.42 * k, 0.6 * k, 1); f.pl.intensity = f.base * k * (dark > 0 ? 0.2 : 1);
    }
    for (const r of world.runes) r.material.opacity = 0.6 + Math.sin(time * 2.2) * 0.3;
    for (const c of Object.values(world.chests)) { if (c.lidOpen && c.lidG.rotation.x > -1.2) c.lidG.rotation.x -= dt * 3; c.shine.material.opacity = 0.35 + Math.sin(time * 3) * 0.25; }
  }
  // 敵
  if (battle) {
    for (const m of battle.meshes) {
      m.appear = Math.min(1, (performance.now() - m.born) / 450);
      m.lunge = Math.max(0, m.lunge - dt * 3);
      const toCam = new THREE.Vector3(camera.position.x - m.base.x, 0, camera.position.z - m.base.z).normalize();
      const off = Math.sin(m.lunge * Math.PI) * 0.35;
      m.mesh.position.set(m.base.x + toCam.x * off, m.size / 2 + 0.02 + Math.sin(time * 1.7 + m.seed) * 0.025 + (1 - m.appear) * -0.3, m.base.z + toCam.z * off);
      m.mesh.lookAt(camera.position.x, m.mesh.position.y, camera.position.z);
      m.flash = Math.max(0, m.flash - dt * 4);
      m.mesh.material.emissive.setScalar(m.flash * 1.6);
      if (m.dying) {
        m.dying = Math.max(0, m.dying - dt * 1.3);
        m.mesh.material.opacity = m.dying; m.mesh.material.alphaTest = 0.35 + (1 - m.dying) * 0.6;
        m.mesh.scale.set(1 + (1 - m.dying) * 0.25, 1 - (1 - m.dying) * 0.5, 1);
        if (m.dying <= 0) m.mesh.visible = false;
      } else if (m.e.hp > 0) {
        m.mesh.material.opacity = m.appear;
        const slept = m.e.sleep > 0, t = m.tone; m.mesh.material.color.setRGB(t * (slept ? 0.7 : 1), t * (slept ? 0.8 : 1), t);
      }
    }
    updateFoeLabels();
  }
  // 塵
  const p = dustGeo.attributes.position.array;
  for (let i = 0; i < DUST; i++) {
    let x = p[i * 3] + dustVel[i * 3], y = p[i * 3 + 1] + dustVel[i * 3 + 1], z = p[i * 3 + 2] + dustVel[i * 3 + 2];
    if (y > WALL_H) y = 0.05; if (y < 0) y = WALL_H - 0.05;
    if (Math.abs(x - camera.position.x) > 7) x = camera.position.x + (Math.random() - 0.5) * 12;
    if (Math.abs(z - camera.position.z) > 7) z = camera.position.z + (Math.random() - 0.5) * 12;
    p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
  }
  dustGeo.attributes.position.needsUpdate = true;
  // 火花
  const grav = sparkPoints.userData.gravity ?? 1;
  for (let i = 0; i < SP; i++) {
    if (spLife[i] <= 0) { spPos[i * 3 + 1] = -99; continue; }
    spLife[i] -= dt; spVel[i * 3 + 1] -= 9 * dt * grav;
    spPos[i * 3] += spVel[i * 3] * dt; spPos[i * 3 + 1] += spVel[i * 3 + 1] * dt; spPos[i * 3 + 2] += spVel[i * 3 + 2] * dt;
    if (spPos[i * 3 + 1] < 0.02) { spPos[i * 3 + 1] = 0.02; spVel[i * 3 + 1] *= -0.35; }
  }
  spGeo.attributes.position.needsUpdate = true;

  grade.uniforms.uTime.value = time;
  grade.uniforms.uHurt.value = hurtT; hurtT = Math.max(0, hurtT - dt * 1.5);
  perf.frames++;
  if (!perf.lowered && time > 5 && time - perf.t0 > 3) { if (perf.frames / (time - perf.t0) < 28) lowerQuality(); perf.frames = 0; perf.t0 = time; }
  composer.render(dt);
  requestAnimationFrame(tick);
}
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

// 表題の背後に迷宮を映しておく
state = newState();
buildFloor(0); placeCamera();
setTimeout(() => { $("fade").style.opacity = 0; }, 200);
tick();

// 自動確認用
window.__g = { get state() { return state; }, get mode() { return mode; }, get battle() { return battle; }, startBattle, act, changeFloor, startNew,
  tp(x, y, d) { state.x = x; state.y = y; state.dir = d; placeCamera(); reveal(); renderHud(); } };
