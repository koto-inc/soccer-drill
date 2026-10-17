// 問題データ（src/data/q_*.js）の文字列リテラルの中だけを、辞書で「配当表外の漢字 → ひらがな」に置き換える。
//   node tools/kanji-to-kana.mjs            … 書き換える
//   node tools/kanji-to-kana.mjs --dry-run  … 置換の件数だけ表示
// 辞書は上から順に適用する（長い語・特別な言い回しを先に、1文字の一般ルールを後に）。
// 置き換えたあとは必ず tools/check-kanji.mjs で確認し、文を目で読んで不自然なところを直すこと。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['src/data/q_base.js', 'src/data/q_partA.js', 'src/data/q_partB.js', 'src/data/q_partC.js'];
const dry = process.argv.includes('--dry-run');

export const DICT = [
  // --- 言い回し（先に） ---
  ['ボールを背にする', 'ボールにせなかを向ける'],
  ['自陣ゴール', '自分のゴール'],
  ['自陣深くで', '自分のゴールの近くで'],
  ['自陣深くの', '自分のゴールの近くの'],
  ['（自陣側）', '（自分のゴールに近いほう）'],
  ['相手陣スローイン', '相手のじんちでのスローイン'],
  ['自陣', '自分のじんち'],
  ['相手陣', '相手のじんち'],
  ['攻守の切り替え', 'こうげきとしゅびの切りかえ'],
  ['攻守', 'こうげきとしゅび'],
  ['切り替え', '切りかえ'],
  ['弧のあたり', '半円のあたり'],
  ['体勢が悪', 'バランスが悪'],
  ['ざるを得ない', 'ざるをえない'],
  ['最大の', 'いちばん大きな'],
  ['最初', 'さいしょ'],
  ['中途半端', 'ちゅうとはんぱ'],
  ['途中', 'とちゅう'],
  ['中盤', 'ピッチの真ん中'],
  ['限定する', 'かぎる'],
  ['限り', 'かぎり'],
  ['付近', 'の近く'],
  ['付ける', 'つける'],
  ['折り返', 'おり返'],
  ['連れ出', 'つれ出'],
  ['手伝う', '手つだう'],
  ['見失', '見うしな'],
  // --- 2字以上の語 ---
  ['背中側', 'せなかがわ'],
  ['背中', 'せなか'],
  ['外側', '外がわ'],
  ['内側', '内がわ'],
  ['反対側', '反対がわ'],
  ['片側', 'かたがわ'],
  ['自分側', '自分がわ'],
  ['片方', 'かたほう'],
  ['一瞬', 'いっしゅん'],
  ['瞬間', 'しゅんかん'],
  ['攻撃', 'こうげき'],
  ['攻め', 'せめ'],
  ['守備', 'しゅび'],
  ['準備', 'じゅんび'],
  ['備え', 'そなえ'],
  ['位置', '場所'],
  ['置いたま', 'おいたま'],
  ['置きざり', 'おきざり'],
  ['逆サイド', 'ぎゃくサイド'],
  ['逆', 'ぎゃく'],
  ['構え', 'かまえ'],
  ['対応', 'たいおう'],
  ['反応', 'はんのう'],
  ['選択肢', 'せんたくし'],
  ['選手', 'せんしゅ'],
  ['競り合', 'せり合'],
  ['競り', 'せり'],
  ['競る', 'せる'],
  ['競った', 'せった'],
  ['距離', 'きょり'],
  ['離れ', 'はなれ'],
  ['必ず', 'かならず'],
  ['必要', 'ひつよう'],
  ['直接', 'ちょくせつ'],
  ['反則', 'はんそく'],
  ['解説', 'かいせつ'],
  ['正解', 'せいかい'],
  ['基本', 'きほん'],
  ['結ぶ', 'むすぶ'],
  ['一緒', 'いっしょ'],
  ['以上', 'いじょう'],
  ['以外', 'いがい'],
  ['周り', 'まわり'],
  ['対策', 'たいさく'],
  ['関われ', 'かかわれ'],
  ['混ざ', 'まざ'],
  ['混雑', 'こんざつ'],
  ['確認', 'かくにん'],
  ['展開', 'てんかい'],
  ['増え', 'ふえ'],
  ['忘れ', 'わすれ'],
  ['作戦', 'さくせん'],
  ['文句', 'もんく'],
  ['参加', 'さんか'],
  ['突破', 'とっぱ'],
  ['並ぶ', 'ならぶ'],
  ['有利', 'ゆうり'],
  ['続け', 'つづけ'],
  ['困らせ', 'こまらせ'],
  ['退場', 'たいじょう'],
  ['余裕', 'よゆう'],
  ['探す', 'さがす'],
  ['移動', 'いどう'],
  ['防ぐ', 'ふせぐ'],
  ['武器', 'ぶき'],
  ['警戒', 'けいかい'],
  ['責任', 'せきにん'],
  ['無い', 'ない'],
  ['別の', 'べつの'],
  // --- 1字の一般ルール（送りがなと組み合わさる動詞など） ---
  ['裏', 'うら'],
  ['側', 'がわ'],
  ['背', 'せ'],
  ['寄', 'よ'],
  ['戻', 'もど'],
  ['残', 'のこ'],
  ['壁', 'かべ'],
  ['絞', 'しぼ'],
  ['際', 'ぎわ'],
  ['抜', 'ぬ'],
  ['縦', 'たて'],
  ['迷', 'まよ'],
  ['失', 'うしな'],
  ['届', 'とど'],
  ['押', 'お'],
  ['減', 'へ'],
  ['替え', 'かえ'],
  ['沿い', 'ぞい'],
  ['変', 'か'],
  ['低', 'ひく'],
  ['幅', 'はば'],
  ['渡', 'わた'],
  ['誰', 'だれ'],
  ['扇', 'おうぎ'],
  ['選', 'えら'],
  ['別', 'べつ'],
];

// 文字列リテラルの中身の範囲 [start, end) を列挙する（tools/check-kanji.mjs と同じ規則）
function stringRanges(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  const prevSig = (k) => { k--; while (k >= 0 && /\s/.test(src[k])) k--; return k < 0 ? '' : src[k]; };
  function scan(stopAtBrace) {
    let depth = 0;
    while (i < n) {
      const c = src[i], d = src[i + 1];
      if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
      if (c === '/' && ('(,=:[!&|?{};+-*%<>~^'.includes(prevSig(i)) || prevSig(i) === '')) {
        i++; let cls = false;
        while (i < n && src[i] !== '\n') { if (src[i] === '\\') { i += 2; continue; } if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; else if (src[i] === '/' && !cls) break; i++; }
        i++; continue;
      }
      if (c === "'" || c === '"') {
        const q = c; i++; const s = i;
        while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++; }
        out.push([s, i]); i++; continue;
      }
      if (c === '`') {
        i++; let s = i;
        while (i < n && src[i] !== '`') {
          if (src[i] === '\\') { i += 2; continue; }
          if (src[i] === '$' && src[i + 1] === '{') { out.push([s, i]); i += 2; scan(true); s = i; continue; }
          i++;
        }
        out.push([s, i]); i++; continue;
      }
      if (stopAtBrace) { if (c === '{') depth++; else if (c === '}') { if (depth === 0) { i++; return; } depth--; } }
      i++;
    }
  }
  scan(false);
  return out;
}

export function convert(src, counter) {
  const ranges = stringRanges(src);
  let out = '', last = 0;
  for (const [s, e] of ranges) {
    out += src.slice(last, s);
    let t = src.slice(s, e);
    for (const [from, to] of DICT) {
      if (!t.includes(from)) continue;
      const parts = t.split(from);
      if (counter) counter[from] = (counter[from] || 0) + parts.length - 1;
      t = parts.join(to);
    }
    out += t; last = e;
  }
  return out + src.slice(last);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const counter = {};
  for (const f of FILES) {
    const p = path.join(ROOT, f);
    const src = fs.readFileSync(p, 'utf8');
    const next = convert(src, counter);
    if (next !== src && !dry) fs.writeFileSync(p, next);
    console.log(`${f}: ${next === src ? '変更なし' : (dry ? '変更あり（書き込まない）' : '書き込んだ')}`);
  }
  console.log(Object.entries(counter).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}→${v}`).join('  '));
}
