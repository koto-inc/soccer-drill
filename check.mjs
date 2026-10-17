// ビルド結果の確認: 全問のページがあり、HTMLソースに問題文が入っているか。 `npm run check`
// あわせて、子どもが見る文章の漢字が小学1〜3年の配当漢字だけか（tools/check-kanji.mjs）と、
// 問題に出てくるカタカナ語が用語辞書（src/data/terms.js）に全部あるか（tools/list-terms.mjs）も調べる。
import fs from 'node:fs';
import path from 'node:path';
import { checkAll as checkKanji } from './tools/check-kanji.mjs';
import { missingTerms } from './tools/list-terms.mjs';

const DIST = path.resolve('dist');
const code = ['q_helpers.js', 'q_base.js', 'q_partA.js', 'q_partB.js', 'q_partC.js']
  .map((f) => fs.readFileSync(path.join('src/data', f), 'utf8')).join('\n') + '\nreturn [...BASE5, ...PART_A, ...PART_B, ...PART_C];';
const QUESTIONS = new Function(code)();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stripTags = (html) => html.replace(/<[^>]+>/g, '');   // 用語の下線 <span class="term"> を外して本文を比べる

let ng = 0;
const noWords = [];
QUESTIONS.forEach((q, i) => {
  const id = String(i + 1).padStart(3, '0');
  const file = path.join(DIST, 'q', id, 'index.html');
  if (!fs.existsSync(file)) { console.error(`NG Q${i + 1}: ${file} がない`); ng++; return; }
  const html = fs.readFileSync(file, 'utf8');
  const text = stripTags(html);
  const missing = [q.q, q.title, q.point, ...q.options.map((o) => o.text), ...q.options.map((o) => o.why)].filter((t) => !text.includes(esc(t)));
  const svgs = (html.match(/<svg class="pitch"/g) || []).length;   // 凡例のアイコン（svg）は数えない
  const expectSvg = 1 + q.options.filter((o) => o.ok && o.a).length;
  if (missing.length) { console.error(`NG Q${i + 1}: 本文が足りない: ${missing.join(' / ')}`); ng++; }
  if (svgs !== expectSvg) { console.error(`NG Q${i + 1}: 図の数 ${svgs} ≠ ${expectSvg}`); ng++; }
  if (!html.includes('<meta property="og:image"') || !html.includes('<meta name="description"')) { console.error(`NG Q${i + 1}: meta が無い`); ng++; }
  if (!html.includes('class="words"')) noWords.push(i + 1);   // 用語が1つも出てこない問題（NG ではない）
});
if (noWords.length) console.log(`「ことば」ボックスが無い問題（用語なし）: Q${noWords.join(', Q')}`);
for (const f of ['index.html', 'sitemap.xml', 'robots.txt', '404.html', 'about/index.html', 'privacy/index.html', 'contact/index.html', 'words/index.html', 'style.css', 'app.js']) {
  if (!fs.existsSync(path.join(DIST, f))) { console.error(`NG: dist/${f} がない`); ng++; }
}
const sitemap = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
const n = (sitemap.match(/<url>/g) || []).length;
const png = fs.existsSync(path.join(DIST, 'og')) ? fs.readdirSync(path.join(DIST, 'og')).length : 0;

// 漢字（小学1〜3年の配当表だけか）
const kanji = checkKanji();
for (const b of kanji) console.error(`NG 漢字 ${b.file}:${b.line} ${b.ch} …${b.ctx}…`);
if (kanji.length) { console.error(`NG: 配当表外の漢字 ${kanji.length} 件（${new Set(kanji.map((b) => b.ch)).size} 種類）。tools/check-kanji.mjs で確認`); ng++; }
// 用語辞書（辞書に無いカタカナ語がないか）
const terms = missingTerms();
for (const t of terms) console.error(`NG 用語 ${t.w}（${t.n}件 Q${t.qs.join(',Q')}）が src/data/terms.js に無い`);
if (terms.length) ng++;

console.log(`問題 ${QUESTIONS.length} 問 / sitemap ${n} URL / OGP画像 ${png} 枚 / 漢字 ${kanji.length ? 'NG' : 'OK'} / 用語 ${terms.length ? 'NG' : 'OK'} / ${ng ? 'NG ' + ng + ' 件' : 'すべてOK'}`);
process.exit(ng ? 1 : 0);
