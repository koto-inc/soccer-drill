// 子どもが見る文章の漢字が「小学1〜3年の配当漢字」だけかを調べる。
//   node tools/check-kanji.mjs            … 配当表にない漢字を「ファイル:行 漢字 前後の文脈」で列挙。1件でもあれば exit 1
//   node tools/check-kanji.mjs --summary  … さらに漢字ごとの件数も表示
// 対象: 下の FILES の文字列リテラル（'…' "…" `…`）の中だけ。コメントや識別子は見ない。
// 例外: 行末に「// kanji-ok」が付いた行は調べない（保護者向けの文言・console の警告など）。
// 配当表: tools/kanji-grade123.txt（1年80字・2年160字・3年200字）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = [
  'src/data/q_base.js', 'src/data/q_partA.js', 'src/data/q_partB.js', 'src/data/q_partC.js', 'src/data/q_helpers.js',
  'src/data/terms.js', 'build.mjs', 'src/app.js', 'site.config.mjs',
];
const OK_MARK = /\/\/\s*kanji-ok\s*$/;

export function loadGradeKanji() {
  const txt = fs.readFileSync(path.join(ROOT, 'tools', 'kanji-grade123.txt'), 'utf8');
  const set = new Set();
  const counts = [];
  for (const line of txt.split(/\r?\n/)) {
    if (line.startsWith('#')) { const m = line.match(/（(\d+)字）/); if (m) counts.push(Number(m[1])); continue; }
    for (const ch of line.replace(/\s+/g, '')) set.add(ch);
  }
  const expect = counts.reduce((a, b) => a + b, 0);
  if (expect && set.size !== expect) throw new Error(`kanji-grade123.txt: 字数が合わない（${set.size} ≠ ${expect}）`);
  return set;
}

const isKanji = (ch) => /[㐀-鿿豈-﫿]/u.test(ch);

// 直前の意味のある文字から「ここの / は割り算ではなく正規表現の始まり」かを判断する
function regexAllowed(src, i) {
  let k = i - 1;
  while (k >= 0 && /\s/.test(src[k])) k--;
  if (k < 0) return true;
  const prev = src[k];
  if ('(,=:[!&|?{};+-*%<>~^'.includes(prev)) return true;
  const word = src.slice(Math.max(0, k - 6), k + 1).match(/[A-Za-z_$]+$/);
  return !!(word && ['return', 'typeof', 'case', 'in', 'of', 'do', 'else'].includes(word[0]));
}

// JS ソースから文字列リテラルの中身を取り出す（{text, line}）。コメント・正規表現・識別子は飛ばす。
// テンプレートリテラルは ${ } の中のコードも再帰的に見る。
export function extractStrings(src) {
  const out = [];
  let i = 0, line = 1;
  const n = src.length;
  const push = (text, atLine) => { if (text) out.push({ text, line: atLine }); };
  function scan(stopAtBrace) {   // stopAtBrace: テンプレートの ${ の中（対応する } で戻る）
    let depth = 0;
    while (i < n) {
      const c = src[i], d = src[i + 1];
      if (c === '\n') { line++; i++; continue; }
      if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; } i += 2; continue; }
      if (c === '/' && regexAllowed(src, i)) {   // 正規表現リテラル（中の ' や " を文字列と間違えないように飛ばす）
        i++; let inClass = false;
        while (i < n && src[i] !== '\n') {
          if (src[i] === '\\') { i += 2; continue; }
          if (src[i] === '[') inClass = true; else if (src[i] === ']') inClass = false;
          else if (src[i] === '/' && !inClass) break;
          i++;
        }
        i++; continue;
      }
      if (c === "'" || c === '"') {
        const q = c, start = line; let s = ''; i++;
        while (i < n && src[i] !== q) { if (src[i] === '\\') { s += src[i] + src[i + 1]; i += 2; continue; } if (src[i] === '\n') line++; s += src[i++]; }
        i++; push(s, start); continue;
      }
      if (c === '`') {
        i++; let s = '', start = line;
        while (i < n && src[i] !== '`') {
          if (src[i] === '\\') { s += src[i] + src[i + 1]; i += 2; continue; }
          if (src[i] === '$' && src[i + 1] === '{') { push(s, start); s = ''; i += 2; scan(true); start = line; continue; }
          if (src[i] === '\n') { push(s, start); s = ''; line++; start = line + 0; i++; continue; }
          s += src[i++];
        }
        i++; push(s, start); continue;
      }
      if (stopAtBrace) {
        if (c === '{') depth++;
        else if (c === '}') { if (depth === 0) { i++; return; } depth--; }
      }
      i++;
    }
  }
  scan(false);
  return out;
}

export function checkFile(file, grade) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) return [];
  const src = fs.readFileSync(abs, 'utf8');
  const lines = src.split('\n');
  const bad = [];
  for (const { text, line } of extractStrings(src)) {
    if (OK_MARK.test(lines[line - 1] || '')) continue;
    for (let k = 0; k < text.length; k++) {
      const ch = text[k];
      if (!isKanji(ch) || grade.has(ch)) continue;
      const ctx = text.slice(Math.max(0, k - 8), k + 9).replace(/\s+/g, ' ');
      bad.push({ file, line, ch, ctx });
    }
  }
  return bad;
}

export function checkAll() {
  const grade = loadGradeKanji();
  return FILES.flatMap((f) => checkFile(f, grade));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bad = checkAll();
  for (const b of bad) console.log(`${b.file}:${b.line} ${b.ch} …${b.ctx}…`);
  if (process.argv.includes('--summary')) {
    const freq = {};
    for (const b of bad) freq[b.ch] = (freq[b.ch] || 0) + 1;
    console.log('--- 漢字ごとの件数 ---');
    console.log(Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}${v}`).join(' '));
  }
  console.log(bad.length ? `配当表外の漢字 ${bad.length} 件（${new Set(bad.map((b) => b.ch)).size} 種類）` : '配当表外の漢字なし');
  process.exit(bad.length ? 1 : 0);
}
