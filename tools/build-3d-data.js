// 通常版（main.js）のゲームデータを、立体版が読める形（3d/data.js）に書き出す。
// 使い方: node tools/build-3d-data.js
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8");

function block(name) {
  const start = src.indexOf(`const ${name} = `);
  if (start < 0) throw new Error(`見つからない: ${name}`);
  const open = src.indexOf("=", start) + 1;
  // 行頭の "};" または "];" までを1つのまとまりとして取り出す
  const re = /\n[\]}];/g;
  re.lastIndex = open;
  const m = re.exec(src);
  return src.slice(open, m.index + 2).trim();
}
function str(name) {
  const m = src.match(new RegExp(`const ${name} = ("(?:[^"\\\\]|\\\\.)*");`));
  return JSON.parse(m[1]);
}

const names = ["CLASSES", "partyTemplate", "EQUIPMENT", "ITEMS", "SPELLS", "CHESTS", "MONSTERS", "FLOORS", "NAMED_ALLIES"];
const data = {};
for (const n of names) data[n] = new Function(`return (${block(n)});`)();
const _D = new Function(`return (${block("_D")});`)();
data.SPRITES = new Function("_D", `return (${block("SPRITES")});`)(_D);
data.PROLOGUE = str("PROLOGUE");
data.BOSS_INTRO = str("BOSS_INTRO");

const out = "// 自動生成ファイル（tools/build-3d-data.js）。直接編集しないこと。\n" +
  Object.entries(data).map(([k, v]) => `export const ${k} = ${JSON.stringify(v)};`).join("\n") + "\n";
fs.writeFileSync(path.join(__dirname, "..", "3d", "data.js"), out);
console.log("3d/data.js を書き出しました", Object.fromEntries(Object.entries(data).map(([k, v]) => [k, typeof v === "string" ? v.length : Object.keys(v).length])));
