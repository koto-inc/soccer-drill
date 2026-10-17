// 選択肢（ア〜オ）の並びを、問題IDをシードにした決定的な疑似乱数で並べ替えて
// src/data/q_partA/B/C.js を書き換える。実行は1回だけ（2回目は先頭のマーカーを見て止まる）。
//   node tools/shuffle-options.mjs            … 並べ替えて書き込む
//   node tools/shuffle-options.mjs --dry-run  … 分布だけ表示（書き込まない）
// q_base.js（Q1〜Q5）は手書きで偏りがないので触らない。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'src', 'data');
const FILES = [{ f: 'q_partA.js', first: 6 }, { f: 'q_partB.js', first: 39 }, { f: 'q_partC.js', first: 68 }];
const MARKER = '/* options shuffled';
const dry = process.argv.includes('--dry-run');

// mulberry32: シードから決まる疑似乱数
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// 問題 id と salt から n 個の並び（元の添字の配列）を決める
function orderFor(id, n, salt) {
  const r = rng(id * 7919 + salt * 104729 + 12345);
  const idx = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
}

// ---- テキストから options ブロック（[O(...), ...]）を取り出して項目ごとに分ける ----
function splitItems(src, start) {   // start = '[' の位置。戻り: {end, items:[text...]}
  let depth = 0, i = start, inStr = null, items = [], itemStart = start + 1;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
    if (c === '[' || c === '(' || c === '{') depth++;
    else if (c === ']' || c === ')' || c === '}') {
      depth--;
      if (depth === 0) { items.push(src.slice(itemStart, i)); return { end: i, items }; }
    } else if (c === ',' && depth === 1) { items.push(src.slice(itemStart, i)); itemStart = i + 1; }
  }
  throw new Error('options ブロックが閉じていない: ' + start);
}

function evalAll(files) {
  const code = ['q_helpers.js', 'q_base.js', ...files.map((x) => x.f)].map((f) => fs.readFileSync(path.join(DATA, f), 'utf8')).join('\n')
    + '\nreturn [...BASE5, ...PART_A, ...PART_B, ...PART_C];';
  return new Function(code)();
}

function rewrite(salt) {
  const out = {};
  for (const { f, first } of FILES) {
    const src = fs.readFileSync(path.join(DATA, f), 'utf8');
    if (src.startsWith(MARKER)) throw new Error(`${f} はすでに並べ替え済み（先頭にマーカーあり）。元に戻してから実行すること`);
    let res = '', pos = 0, id = first, blocks = 0;
    const re = /\[O\(/g; let m;
    while ((m = re.exec(src))) {
      const { end, items: raw } = splitItems(src, m.index);
      const items = raw.filter((t) => t.trim() !== '');   // 末尾の「,]」で空になる項目は捨てる
      if (items.length !== 5) throw new Error(`${f} Q${id}: 選択肢が ${items.length} 個`);
      const order = orderFor(id, 5, salt);
      // 1つ目は「[」の直後なのでインデントなし、2つ目以降は2スペース（元ファイルと同じ見た目）
      const body = order.map((k, j) => (j === 0 ? '' : '  ') + items[k].replace(/^\s+/, '')).join(',\n');
      res += src.slice(pos, m.index + 1) + body;
      pos = end; re.lastIndex = end; id++; blocks++;
    }
    res += src.slice(pos);
    out[f] = { text: `${MARKER}: seed=id, salt=${salt} (tools/shuffle-options.mjs) */\n` + res, blocks };
  }
  return out;
}

function stats(qs) {
  const pos = [0, 0, 0, 0, 0]; let multi = 0, adj = 0;
  for (const q of qs) {
    const ok = q.options.map((o, j) => (o.ok ? j : -1)).filter((j) => j >= 0);
    ok.forEach((j) => pos[j]++);
    if (ok.length > 1) { multi++; if (ok.some((j, k) => k > 0 && j - ok[k - 1] === 1)) adj++; }
  }
  const total = pos.reduce((a, b) => a + b, 0);
  const pct = pos.map((p) => (100 * p) / total);
  const okDist = pct.every((p) => p >= 12 && p <= 28);
  const okAdj = adj / multi <= 0.5;
  return { pos, total, pct, multi, adj, pass: okDist && okAdj, firstAll: qs.every((q) => q.options[0].ok) };
}

// salt を 0 から順に試し、条件（各位置 20%±8%、隣り合う正解が半分以下）を満たす最初のものを使う
let chosen = null;
for (let salt = 0; salt < 500; salt++) {
  const out = rewrite(salt);
  const tmp = path.join(ROOT, '.shuffle-tmp'); fs.mkdirSync(tmp, { recursive: true });
  for (const f of ['q_helpers.js', 'q_base.js']) fs.copyFileSync(path.join(DATA, f), path.join(tmp, f));
  for (const f in out) fs.writeFileSync(path.join(tmp, f), out[f].text);
  const code = ['q_helpers.js', 'q_base.js', 'q_partA.js', 'q_partB.js', 'q_partC.js'].map((f) => fs.readFileSync(path.join(tmp, f), 'utf8')).join('\n') + '\nreturn [...BASE5, ...PART_A, ...PART_B, ...PART_C];';
  const qs = new Function(code)();
  const st = stats(qs);
  fs.rmSync(tmp, { recursive: true, force: true });
  if (st.pass) { chosen = { salt, out, st, qs }; break; }
}
if (!chosen) { console.error('条件を満たす salt が見つからない'); process.exit(1); }

// 元データと比べて、選択肢の中身が同じ集合か確認
const orig = evalAll(FILES);
chosen.qs.forEach((q, i) => {
  const a = orig[i].options.map((o) => o.text + '|' + o.ok + '|' + o.why).sort().join('\n');
  const b = q.options.map((o) => o.text + '|' + o.ok + '|' + o.why).sort().join('\n');
  if (a !== b) throw new Error(`Q${i + 1}: 並べ替え前後で選択肢の中身が一致しない`);
});

const { salt, out, st } = chosen;
console.log(`salt=${salt}`);
console.log('正解位置 ア〜オ:', st.pos.join(' / '), `（計 ${st.total}）`, st.pct.map((p) => p.toFixed(0) + '%').join(' '));
console.log(`複数正解の問題 ${st.multi} 問、うち正解が隣り合う ${st.adj} 問 = ${((100 * st.adj) / st.multi).toFixed(0)}%`);
if (dry) { console.log('(dry-run: 書き込まない)'); process.exit(0); }
for (const f in out) { fs.writeFileSync(path.join(DATA, f), out[f].text); console.log(`書き込み: src/data/${f}（${out[f].blocks} 問）`); }
