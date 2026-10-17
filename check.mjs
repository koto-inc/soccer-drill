// ビルド結果の確認: 全問のページがあり、HTMLソースに問題文が入っているか。 `npm run check`
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist');
const code = ['q_helpers.js', 'q_base.js', 'q_partA.js', 'q_partB.js', 'q_partC.js']
  .map((f) => fs.readFileSync(path.join('src/data', f), 'utf8')).join('\n') + '\nreturn [...BASE5, ...PART_A, ...PART_B, ...PART_C];';
const QUESTIONS = new Function(code)();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let ng = 0;
QUESTIONS.forEach((q, i) => {
  const id = String(i + 1).padStart(3, '0');
  const file = path.join(DIST, 'q', id, 'index.html');
  if (!fs.existsSync(file)) { console.error(`NG Q${i + 1}: ${file} がない`); ng++; return; }
  const html = fs.readFileSync(file, 'utf8');
  const missing = [q.q, q.title, q.point, ...q.options.map((o) => o.text), ...q.options.map((o) => o.why)].filter((t) => !html.includes(esc(t)));
  const svgs = (html.match(/<svg class="pitch"/g) || []).length;   // 凡例のアイコン（svg）は数えない
  const expectSvg = 1 + q.options.filter((o) => o.ok && o.a).length;
  if (missing.length) { console.error(`NG Q${i + 1}: 本文が足りない: ${missing.join(' / ')}`); ng++; }
  if (svgs !== expectSvg) { console.error(`NG Q${i + 1}: 図の数 ${svgs} ≠ ${expectSvg}`); ng++; }
  if (!html.includes('<meta property="og:image"') || !html.includes('<meta name="description"')) { console.error(`NG Q${i + 1}: meta が無い`); ng++; }
});
for (const f of ['index.html', 'sitemap.xml', 'robots.txt', '404.html', 'about/index.html', 'privacy/index.html', 'contact/index.html', 'style.css', 'app.js']) {
  if (!fs.existsSync(path.join(DIST, f))) { console.error(`NG: dist/${f} がない`); ng++; }
}
const sitemap = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
const n = (sitemap.match(/<url>/g) || []).length;
const png = fs.existsSync(path.join(DIST, 'og')) ? fs.readdirSync(path.join(DIST, 'og')).length : 0;
console.log(`問題 ${QUESTIONS.length} 問 / sitemap ${n} URL / OGP画像 ${png} 枚 / ${ng ? 'NG ' + ng + ' 件' : 'すべてOK'}`);
process.exit(ng ? 1 : 0);
