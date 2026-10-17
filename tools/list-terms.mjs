// 問題データに出てくるカタカナ語（と 1対1・PK などの記号語）を全部ひろい、
// src/data/terms.js の用語辞書に無いものを件数つきで列挙する。
//   node tools/list-terms.mjs          … 辞書に無い語だけ
//   node tools/list-terms.mjs --all    … 全部の語と件数（辞書にあるものは ✓）
// 「ボール」「シュート」のような、小3でもふつうに知っている語は IGNORE に入れてある。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TERMS } from '../src/data/terms.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['q_helpers.js', 'q_base.js', 'q_partA.js', 'q_partB.js', 'q_partC.js'];
const all = process.argv.includes('--all');

// 辞書を引かなくてもわかる、ふだんの言葉
const IGNORE = new Set(['ボール', 'ゴール', 'シュート', 'パス', 'チーム', 'チャンス', 'ピンチ', 'タイミング', 'コツ', 'スピード', 'ダッシュ', 'ジャンプ',
  'キャッチ', 'バランス', 'ヘディング', 'ターン', 'セット', 'ショート', 'ロング', 'フリー', 'コース', 'ストップ', 'キック', 'キーパー', 'プレー', 'プレーヤー', 'ルール', 'バラバラ']);

const code = FILES.map((f) => fs.readFileSync(path.join(ROOT, 'src/data', f), 'utf8')).join('\n') + '\nreturn [...BASE5, ...PART_A, ...PART_B, ...PART_C];';
const QUESTIONS = new Function(code)();
QUESTIONS.forEach((q, i) => { q.id = i + 1; });

// 各問の文章（title / q / 選択肢 / why / point / 図のラベル）
export function questionTexts(q) {
  const labs = (a) => [...((a && a.zones) || []).map((z) => z.l), ...((a && a.labels) || []).map((l) => l.t)];
  return [q.title, q.q, ...q.options.flatMap((o) => [o.text, o.why, ...labs(o.a)]), q.point, ...labs(q.scene)].filter(Boolean);
}

const WORD = /[A-Za-z0-9０-９]*[ァ-ヶー]+[A-Za-z0-9ァ-ヶー]*|[0-9０-９]対[0-9０-９]|\b(?:PK|CK|FK|GK|DF|MF|FW|SB|CB)\b/g;
const freq = new Map();
for (const q of QUESTIONS) {
  for (const t of questionTexts(q)) {
    for (const m of t.matchAll(WORD)) {
      const w = m[0];
      if (/^(GK|DF|MF|FW|SB|CB)$/.test(w)) continue;
      const e = freq.get(w) || { n: 0, qs: new Set() };
      e.n++; e.qs.add(q.id); freq.set(w, e);
    }
  }
}
const forms = new Set(TERMS.flatMap((t) => t.forms || [t.t, ...(t.alt || [])]));
// 「DFライン」が辞書にあれば「DFライン」はOK。辞書の語を含む長い語（例: ニアポストがわ）は、含まれる語で説明がつくのでOKとする
const covered = (w) => forms.has(w) || [...forms].some((f) => f.length >= 3 && w.includes(f));

const rows = [...freq.entries()].sort((a, b) => b[1].n - a[1].n);
// 辞書にも IGNORE にもない語 [{w, n, qs}]
export function missingTerms() {
  return rows.filter(([w]) => !(IGNORE.has(w) || covered(w))).map(([w, e]) => ({ w, n: e.n, qs: [...e.qs] }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let missing = 0;
  for (const [w, e] of rows) {
    const ok = IGNORE.has(w) || covered(w);
    if (!ok) missing++;
    if (all || !ok) console.log(`${ok ? '✓' : '  '} ${w}\t${e.n}件\tQ${[...e.qs].slice(0, 6).join(',Q')}${e.qs.size > 6 ? '…' : ''}`);
  }
  console.log(`語 ${rows.length} 種類 / 辞書 ${TERMS.length} 語 / 辞書にもIGNOREにもない語 ${missing} 種類`);
  process.exit(missing ? 1 : 0);
}
