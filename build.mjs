// ===== ポジショニングドリル 静的サイトビルド =====
// 使い方: node build.mjs   → dist/ に全ページを生成
//   src/data/*.js   問題データ（省略記法のまま。ここが唯一の正）
//   src/style.css   見た目（元の単一HTMLと同じ）
//   src/app.js      ブラウザ側の動き（選択→答え合わせ→解説）
//   src/pages/*.html 固定ページ（運営者情報・プライバシーポリシー・お問い合わせ）
//   site.config.mjs サイトURL・GA4・AdSense などの設定
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import config from './site.config.mjs';
import { TERMS } from './src/data/terms.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const BASE = (config.BASE_PATH || '').replace(/\/$/, '');
const SITE = config.SITE_URL.replace(/\/$/, '');
const abs = (p) => SITE + BASE + p;          // 絶対URL（sitemap / canonical / OGP）
const href = (p) => BASE + p;                // ページ内リンク

/* ===================== 問題データの読み込み ===================== */
const DATA_FILES = ['q_helpers.js', 'q_base.js', 'q_partA.js', 'q_partB.js', 'q_partC.js'];
function loadQuestions() {
  const code = DATA_FILES.map((f) => fs.readFileSync(path.join(SRC, 'data', f), 'utf8')).join('\n')
    + '\nreturn [...BASE5, ...PART_A, ...PART_B, ...PART_C];';
  const qs = new Function(code)();
  qs.forEach((q, i) => { q.id = i + 1; });
  return qs;
}
const QUESTIONS = loadQuestions();
const qid = (id) => String(id).padStart(3, '0');
const qpath = (id) => `/q/${qid(id)}/`;

/* ===================== 共通 ===================== */
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const KEYS = ['ア', 'イ', 'ウ', 'エ', 'オ'];
const LV = { 1: '入門', 2: '中級', 3: '上級' };

/* ===== サッカー用語（src/data/terms.js）: 本文の初出に下線、問題ごとの「ことば」ボックス ===== */
const TERM_BY_FORM = new Map();
TERMS.forEach((t, i) => { t.id = i; for (const f of (t.forms || [t.t, ...(t.alt || [])])) TERM_BY_FORM.set(f, t); });
const TERM_FORMS = [...TERM_BY_FORM.keys()].sort((a, b) => b.length - a.length);   // 長い語から先に照合
const TERM_RE = new RegExp(TERM_FORMS.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
const isKana = (ch) => !!ch && /[ァ-ヶー]/.test(ch);
// 文章中の用語の位置を列挙する（カタカナ語の途中にある短い語は数えない）
function findTerms(text) {
  const out = [];
  for (const m of text.matchAll(TERM_RE)) {
    const f = m[0];
    if (isKana(text[m.index - 1]) || isKana(text[m.index + f.length])) continue;
    out.push({ index: m.index, form: f, term: TERM_BY_FORM.get(f) });
  }
  return out;
}
// その問題に出てくる用語（title / q / 選択肢 / why / point / 図のラベル）。hide の語は除く
function termsIn(q) {
  const labs = (a) => [...((a && a.zones) || []).map((z) => z.l), ...((a && a.labels) || []).map((l) => l.t)];
  const texts = [q.title, q.q, ...q.options.flatMap((o) => [o.text, o.why, ...labs(o.a)]), q.point, ...labs(q.scene)].filter(Boolean);
  const seen = new Set();
  for (const t of texts) for (const h of findTerms(t)) if (!h.term.hide) seen.add(h.term);
  return [...seen].sort((a, b) => a.id - b.id);
}
// HTML エスケープしつつ、用語の初出（seen に無いもの）を <span class="term"> で包む。seen は同じ画面内で共有する
function markTerms(text, seen) {
  let out = '', last = 0;
  for (const h of findTerms(text)) {
    if (h.term.hide || seen.has(h.term.id)) continue;
    seen.add(h.term.id);
    out += esc(text.slice(last, h.index)) + `<span class="term" role="button" tabindex="0" data-term="${esc(h.term.t)}" data-d="${esc(h.term.d)}">${esc(h.form)}</span>`;
    last = h.index + h.form.length;
  }
  return out + esc(text.slice(last));
}
function wordsBox(q) {
  const list = termsIn(q);
  if (!list.length) return '';
  // 最初は閉じていて、タップでひらく（選択肢が遠くならないように）
  return `<details class="words">
        <summary class="wtitle">ことばのいみがしりたい（${list.length}）</summary>
        <dl>${list.map((t) => `<div><dt>${esc(t.t)}</dt><dd>${esc(t.d)}</dd></div>`).join('')}</dl>
        <a class="wmore" href="${href('/words/')}">ほかのことばも見る →</a>
      </details>`;
}

/* ===== カテゴリ（TOPで選ぶ出題範囲） ===== */
const CATS = [
  { group: '', items: [{ key: 'all', val: '', label: '全部の問題から', slug: '' }] },
  { group: 'レベル', items: [1, 2, 3].map((l) => ({ key: 'level', val: l, label: LV[l], slug: `level-${l}` })) },
  { group: '場面', items: [
    { key: 'phase', val: 'オフェンス', label: 'オフェンス', slug: 'offense' },
    { key: 'phase', val: 'ディフェンス', label: 'ディフェンス', slug: 'defense' },
    { key: 'phase', val: 'セットプレー', label: 'セットプレー', slug: 'set-play' }] },
  { group: 'セットプレーのしゅるい', items: [
    { key: 'situ', val: 'ゴールキック', label: 'ゴールキック', slug: 'goal-kick' },
    { key: 'situ', val: 'スローイン', label: 'スローイン', slug: 'throw-in' },
    { key: 'situ', val: 'コーナーキック', label: 'コーナー（せめ・守り）', slug: 'corner-kick' },
    { key: 'situ', val: 'フリーキック', label: 'フリーキック（せめ・守り）', slug: 'free-kick' },
    { key: 'situ', val: 'キックオフ', label: 'キックオフ（せめ・守り）', slug: 'kick-off' },
    { key: 'situ', val: 'PK', label: 'PK（せめ・守り）', slug: 'pk' }] },
  { group: 'ポジション', items: [
    { key: 'pos', val: 'FW', label: 'FW', slug: 'fw' },
    { key: 'pos', val: 'MF（中央）', label: 'MF（中央）', slug: 'mf-center' },
    { key: 'pos', val: 'MF（サイド）', label: 'MF（サイド）', slug: 'mf-side' },
    { key: 'pos', val: 'DF（センターバック）', label: 'DF（CB）', slug: 'df-cb' },
    { key: 'pos', val: 'DF（サイドバック）', label: 'DF（SB）', slug: 'df-sb' },
    { key: 'pos', val: 'GK', label: 'GK', slug: 'gk' }] },
];
const ALL_CATS = CATS.flatMap((g) => g.items.map((it) => ({ ...it, group: g.group })));
function matchCat(q, c) {
  switch (c.key) {
    case 'level': return q.level === c.val;
    case 'phase': return q.phase === c.val;
    case 'situ': return q.situ.startsWith(c.val);
    case 'pos': return q.pos === c.val || (c.val === 'DF（センターバック）' && q.pos === 'DF');
    default: return true;
  }
}
const filtered = (c) => QUESTIONS.filter((q) => matchCat(q, c));
const catPath = (c) => (c.slug ? `/c/${c.slug}/` : '/');
const findCat = (key, val) => ALL_CATS.find((c) => c.key === key && (c.val === val || (key === 'pos' && val === 'DF' && c.val === 'DF（センターバック）')));
const situCat = (q) => ALL_CATS.find((c) => c.key === 'situ' && q.situ.startsWith(c.val));

/* ===================== 図の描画（元HTMLと同じ） ===================== */
const W = 68, H = 52.5;
const CSS_COLORS = { us: 'var(--us)', them: 'var(--them)', me: 'var(--me)', grass1: 'var(--grass1)', grass2: 'var(--grass2)', font: 'var(--font)' };
// OGP画像（PNG化）用：CSS変数が使えないので実際の色・フォント名を入れる
const OG_COLORS = { us: '#2f6fe0', them: '#e0423a', me: '#ffd23f', grass1: '#4fa85a', grass2: '#46a052', font: 'M PLUS Rounded 1c', png: true };

function P(scene, x, y) { return scene.view === 'bottom' ? [x, H - y] : [x, y]; }

function pitchLines(scene) {
  const flip = scene.view === 'bottom';
  const g = flip ? `transform="translate(0 ${H}) scale(1 -1)"` : '';
  return `<g ${g} fill="none" stroke="#ffffff" stroke-width=".5" stroke-opacity=".9">
    <rect x="0" y="0" width="${W}" height="${H}"/>
    <rect x="13.84" y="0" width="40.32" height="16.5"/>
    <rect x="24.85" y="0" width="18.3" height="5.5"/>
    <circle cx="34" cy="11" r=".5" fill="#fff"/>
    <path d="M26.69 16.5 A9.15 9.15 0 0 0 41.31 16.5"/>
    <path d="M24.85 ${H} A9.15 9.15 0 0 1 43.15 ${H}"/>
    <rect x="30.35" y="-2" width="7.3" height="2" fill="#ffffff" fill-opacity=".35" stroke-width=".4"/>
  </g>`;
}

function arrowPath(scene, a, id) {
  let pts = a.pts.map((p) => P(scene, p[0], p[1]));
  if (a.kind === 'touch' && pts.length >= 2) {   // 始点を選手の円の外（3.2）へずらす
    const [x0, y0] = pts[0], [x1, y1] = pts[1];
    const len = Math.hypot(x1 - x0, y1 - y0) || 1, off = Math.min(3.2, len * 0.4);
    const f2 = (v) => Math.round(v * 100) / 100;
    pts = [[f2(x0 + (x1 - x0) / len * off), f2(y0 + (y1 - y0) / len * off)], ...pts.slice(1)];
  }
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
  const style = {
    run: { stroke: '#ffd23f', w: 1.1, dash: '' },
    pass: { stroke: '#ffffff', w: .9, dash: '1.6 1.2' },
    dribble: { stroke: '#ffffff', w: .9, dash: '.5 1' },
    look: { stroke: '#ffd23f', w: .5, dash: '1 1' },
    touch: { stroke: '#ffffff', w: 1.3, dash: '' },
  }[a.kind];
  if (!style) throw new Error('unknown arrow kind: ' + a.kind);
  const last = pts[pts.length - 1];
  const ball = a.kind === 'touch' ? `<circle cx="${last[0]}" cy="${last[1]}" r=".95" fill="#fff" stroke="#111" stroke-width=".3"/><circle cx="${last[0]}" cy="${last[1]}" r=".38" fill="#111"/>` : '';
  const marker = a.kind === 'look' ? '' : `marker-end="url(#ah-${id}-${a.kind === 'run' || a.kind === 'look' ? 'y' : 'w'})"`;
  return `<path d="${d}" fill="none" stroke="${style.stroke}" stroke-width="${style.w}" ${style.dash ? `stroke-dasharray="${style.dash}"` : ''} stroke-linecap="round" stroke-linejoin="round" ${marker}/>` + ball;
}

// 体の向き（視野の扇）。correct=true は解答図の「正しい向き」（黄色）、false は今の向き（白）
function wedge(scene, x, y, to, correct, C) {
  const [cx, cy] = P(scene, x, y);
  const [tx, ty] = P(scene, to[0], to[1]);
  const a = Math.atan2(ty - cy, tx - cx), r = 7.2, h = Math.PI * 34 / 180;
  const f = (v) => Math.round(v * 100) / 100;
  const x1 = f(cx + r * Math.cos(a - h)), y1 = f(cy + r * Math.sin(a - h)), x2 = f(cx + r * Math.cos(a + h)), y2 = f(cy + r * Math.sin(a + h));
  const lx = f(cx + r * 0.8 * Math.cos(a)), ly = f(cy + r * 0.8 * Math.sin(a));
  const col = correct ? '#ffd23f' : '#ffffff';
  return `<g class="face${correct ? ' face-ok' : ''}"><path d="M${f(cx)} ${f(cy)} L${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2} Z" fill="${col}" fill-opacity="${correct ? .4 : .26}" stroke="${col}" stroke-width="${correct ? .45 : .25}" ${correct ? 'stroke-dasharray="1 .7"' : ''} stroke-opacity=".9"/><line x1="${f(cx)}" y1="${f(cy)}" x2="${lx}" y2="${ly}" stroke="${col}" stroke-width="${correct ? .6 : .4}" stroke-linecap="round"/></g>`;
}

function player(scene, p, C) {
  const [x, y] = P(scene, p.x, p.y);
  const me = p.t === 'me';
  const fill = (p.t === 'them' || p.t === 'gk-them') ? C.them : C.us;
  const gk = p.t.startsWith('gk');
  const label = gk ? 'GK' : (p.l || '');
  return `<g>
    ${me ? `<circle cx="${x}" cy="${y}" r="3.1" fill="none" stroke="${C.me}" stroke-width="1"/>` : ''}
    <circle cx="${x}" cy="${y}" r="2.2" fill="${fill}" stroke="${gk ? '#111' : '#fff'}" stroke-width=".4" ${gk ? 'stroke-dasharray=".6 .5"' : ''}/>
    <text x="${x}" y="${y + .65}" font-size="1.7" font-weight="800" fill="#fff" text-anchor="middle" font-family="${C.font}">${esc(label)}</text>
    ${me ? `<rect x="${x - 3.4}" y="${y - 6.6}" width="6.8" height="2.6" rx="1.3" fill="${C.me}"/><text x="${x}" y="${y - 4.6}" font-size="1.8" font-weight="800" fill="#1f2a22" text-anchor="middle" font-family="${C.font}">きみ</text>` : ''}
  </g>`;
}

// 「相手ゴール ▲」の表示。OGP画像用（C.png）はフォントに ▲▼ が無いので三角形をパスで描く
function goalLabel(scene, C) {
  const top = scene.view === 'top';
  const y = top ? -1.3 : H + 3;
  const text = top ? '相手ゴール' : '自分のゴール';
  if (!C.png) return `<text x="66" y="${y}" font-size="2" fill="#fff" text-anchor="end" font-family="${C.font}" font-weight="800">${text} ${top ? '▲' : '▼'}</text>`;
  const tri = top ? `M64.6 ${y - 1.6} L66.2 ${y} L63 ${y} z` : `M63 ${y - 1.6} L66.2 ${y - 1.6} L64.6 ${y} z`;
  return `<text x="62" y="${y}" font-size="2" fill="#fff" text-anchor="end" font-family="${C.font}" font-weight="800">${text}</text><path d="${tri}" fill="#fff"/>`;
}

function renderScene(scene, overlay, id, C = CSS_COLORS, attrs = 'class="pitch"') {
  let players = scene.players.map((p) => ({ ...p }));
  const ov = overlay || {};
  // movers: 位置をずらす（解答図で「動いたあと」を見せる）
  (ov.movers || []).forEach((m) => {
    const p = players.find((q) => q.x === m.from[0] && q.y === m.from[1]);
    if (p) { p.x = m.to[0]; p.y = m.to[1]; }
  });
  const arrows = [...(scene.arrows || []), ...(ov.arrows || [])];
  const zones = ov.zones || [];
  const labels = ov.labels || [];
  const [bx, by] = P(scene, scene.ball.x, scene.ball.y);
  return `<svg ${attrs} viewBox="-2 -4 72 60" role="img" aria-label="ピッチ図" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="ah-${id}-y" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#ffd23f"/></marker>
      <marker id="ah-${id}-w" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#ffffff"/></marker>
      <pattern id="grass-${id}" width="68" height="10.5" patternUnits="userSpaceOnUse"><rect width="68" height="5.25" fill="${C.grass1}"/><rect y="5.25" width="68" height="5.25" fill="${C.grass2}"/></pattern>
    </defs>
    <rect x="-2" y="-4" width="72" height="60" fill="url(#grass-${id})"/>
    ${pitchLines(scene)}
    ${zones.map((z) => { const [zx, zy] = P(scene, z.x, z.y); return `<ellipse cx="${zx}" cy="${zy}" rx="${z.rx}" ry="${z.ry}" fill="#ffd23f" fill-opacity=".28" stroke="#ffd23f" stroke-width=".4" stroke-dasharray="1 .8"/><text x="${zx}" y="${zy + .7}" font-size="2.2" font-weight="800" fill="#fff" text-anchor="middle" font-family="${C.font}" stroke="#1f2a22" stroke-width=".35" paint-order="stroke">${esc(z.l || '')}</text>`; }).join('')}
    ${players.filter((p) => p.face && !(ov.face && p.t === 'me')).map((p) => wedge(scene, p.x, p.y, p.face, false, C)).join('')}
    ${ov.face ? (() => { const me = players.find((p) => p.t === 'me'); return me ? wedge(scene, me.x, me.y, ov.face, true, C) : ''; })() : ''}
    ${arrows.map((a) => arrowPath(scene, a, id)).join('')}
    ${players.map((p) => player(scene, p, C)).join('')}
    <circle cx="${bx}" cy="${by}" r="1.1" fill="#fff" stroke="#111" stroke-width=".35"/>
    <circle cx="${bx}" cy="${by}" r=".45" fill="#111"/>
    ${labels.map((l) => { const [lx, ly] = P(scene, l.x, l.y); return `<text x="${lx}" y="${ly}" font-size="2.1" font-weight="800" fill="#fff" text-anchor="middle" font-family="${C.font}" stroke="#1f2a22" stroke-width=".4" paint-order="stroke">${esc(l.t)}</text>`; }).join('')}
    ${goalLabel(scene, C)}
  </svg>`;
}

/* ===================== ページの部品 ===================== */
function badges(q) {
  const lv = findCat('level', q.level), ph = findCat('phase', q.phase), po = findCat('pos', q.pos), si = situCat(q);
  const b = (c, cls, text) => c ? `<a class="badge ${cls}" href="${href(catPath(c))}">${esc(text)}</a>` : `<span class="badge ${cls}">${esc(text)}</span>`;
  return `<div class="badges">${b(lv, `lv${q.level}`, LV[q.level])}${b(ph, '', q.phase)}${b(po, '', q.pos)}${b(si, '', q.situ)}</div>`;
}
const LEGEND_FACE = `<span><svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true"><path d="M2 12 L15 3 A9 9 0 0 1 16 11 Z" fill="#ffd23f" fill-opacity=".6" stroke="#9a5b00" stroke-width=".8"/><line x1="2" y1="12" x2="12" y2="7" stroke="#9a5b00" stroke-width="1.2"/></svg>体の向き（おうぎ）</span>`;
const LEGEND_TOUCH = `<span><svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true"><line x1="1" y1="6" x2="13" y2="6" stroke="#555" stroke-width="3" stroke-linecap="round"/><path d="M12 2 L17 6 L12 10 Z" fill="#555"/><circle cx="21.5" cy="6" r="3.5" fill="#fff" stroke="#333" stroke-width="1"/></svg>タッチ（太いやじるし＋ボール）</span>`;
function legend(q) {
  const extra = (q && q.level >= 2 ? LEGEND_FACE : '') + (q && q.level >= 3 ? LEGEND_TOUCH : '');
  return `<div class="legend"><span><i class="dot" style="background:var(--us)"></i>味方</span><span><i class="dot" style="background:var(--them)"></i>相手</span><span><i class="dot" style="background:var(--us);box-shadow:0 0 0 2px var(--me)"></i>きみ</span><span><i class="dot" style="background:#fff;border:1px solid #333"></i>ボール</span>${extra}</div>`;
}
const isPlaceholder = (v) => !v || /X{4,}/.test(v);

function analyticsTag() {
  if (isPlaceholder(config.GA_MEASUREMENT_ID)) {
    return `<!-- Google Analytics 4: site.config.mjs の GA_MEASUREMENT_ID に測定ID（G-XXXXXXXXXX）を入れると、ここに計測タグが出力される -->`; // kanji-ok
  }
  const id = esc(config.GA_MEASUREMENT_ID);
  return `<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');</script>`;
}
function adsenseTag() {
  if (isPlaceholder(config.ADSENSE_CLIENT)) {
    return `<!-- Google AdSense: 審査に通ったら site.config.mjs の ADSENSE_CLIENT に ca-pub-XXXX を入れる。ここにサイト全体用のスクリプトが出力される -->`; // kanji-ok
  }
  // 子ども向けコンテンツ: 広告ユニットには data-tag-for-child-directed-treatment="1" を付ける（AdSense ヘルプ「子ども向けとして広告リクエストにタグを付ける」を参照）
  return `<!-- Google AdSense -->
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(config.ADSENSE_CLIENT)}" crossorigin="anonymous"></script>`;
}
// 広告枠。審査通過後、AdSense で作った広告ユニットのコード（<ins class="adsbygoogle" ...>）をこのコメントの位置に出力する。
function adSlot(name, note) {
  return `\n<!-- AD SLOT: ${name} — ${note}。AdSense の広告ユニットコードをここに貼る（子ども向けのため data-tag-for-child-directed-treatment="1" を付ける） -->\n<div class="adslot" data-ad-slot="${name}"></div>\n`; // kanji-ok
}

// 端末側（app.js）に渡す設定
function clientConfig() {
  const levels = {};
  for (const l of [1, 2, 3]) levels[l] = QUESTIONS.filter((q) => q.level === l).map((q) => q.id);
  return { base: BASE, total: QUESTIONS.length, passcode: config.TEAM_PASSCODE ? normalizePass(config.TEAM_PASSCODE) : '', feedback: config.FEEDBACK_ENDPOINT || '', fkey: config.FEEDBACK_KEY || '',
    ranks: config.RANKS, challenge: config.CHALLENGE, levels, levelNames: LV };
}
// 合言葉の正規化（全角→半角、小文字、空白除去）。app.js の normalizePass と同じにしておく
const normalizePass = (s) => String(s).normalize('NFKC').toLowerCase().replace(/\s+/g, '');
// 限定公開ゲート（合言葉 ＋ なまえ）。<html class="locked"> のときだけ表示される（CSS）。
// 合言葉がすでに合っている端末（「べつの人にかわる」のとき）は app.js が合言葉の欄を隠し、なまえだけ聞く。
// TEAM_PASSCODE が空でも、なまえ（記録を分けるため）だけは聞く。
function gateMarkup() {
  const lead = config.TEAM_PASSCODE
    ? 'チームのみんなだけのページだよ。<br>コーチに聞いた<b>合言葉</b>と、きみの<b>なまえ</b>を入れてね。'
    : 'きみの<b>なまえ</b>を入れてね。';
  return `<div id="gate" role="dialog" aria-labelledby="gateTitle">
  <form class="gate-card" id="gateForm" autocomplete="off">
    <div class="gate-logo">⚽</div>
    <h1 id="gateTitle">${esc(config.SITE_NAME)}</h1>
    <p class="gate-lead">${lead}</p>
    <div class="gate-row" id="gatePassRow"${config.TEAM_PASSCODE ? '' : ' hidden'}>
      <label class="gate-label" for="gateInput">あいことば</label>
      <input class="gate-input" id="gateInput" type="text" inputmode="text" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="あいことば" aria-label="合言葉">
    </div>
    <div class="gate-row">
      <label class="gate-label" for="gateName">なまえ（ニックネームでOK）</label>
      <input class="gate-input gate-name" id="gateName" type="text" maxlength="12" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="なまえ" aria-label="なまえ" required>
      <div class="gate-names" id="gateNames" hidden></div>
      <p class="gate-note">本名でなくてもいいよ。きろくを分けたり、ランキングにのせたりするのに使うよ。</p>
    </div>
    <p class="gate-err" id="gateErr" hidden></p>
    <button class="primary big" type="submit">はいる</button>
  </form>
</div>`;
}
// TOP と /challenge/ の「〇〇さんのきろく」「べつの人にかわる」（中身は app.js が書く）
function whoMarkup() {
  return `<p class="who" id="who" hidden><span><b id="whoName"></b>さんのきろく</span><button type="button" class="ghost" id="btnSwitch">べつの人にかわる</button></p>`;
}
// 解答ページの 👍👎 フィードバック（送信は app.js。送り先は site.config.mjs の FEEDBACK_ENDPOINT）
function feedbackMarkup() {
  return `<div class="fb card" id="feedback">
      <p class="fbq">かいせつは、わかりやすかった？</p>
      <p class="fbneed" id="fbNeed">👍 か 👎 をおすと、つぎに進めるよ。</p>
      <div class="fbreasons" id="fbReasons" hidden>
        <p class="fbrq">どこがわかりにくかった？ あてはまるのをタップ（いくつでも。なくてもOK）</p>
        <div class="fbrchips">
          ${['ことばがわからない', '図のどこか分からない', '答えがちがうと思う', 'かんたんすぎ', 'ほかの理由（ひとことに書く）']
            .map((r) => `<button class="fbr" type="button" aria-pressed="false" data-reason="${esc(r)}">${esc(r)}</button>`).join('\n          ')}
        </div>
      </div>
      <input class="fbc" id="fbComment" type="text" maxlength="100" placeholder="どこがわかりにくかった？（なくてもOK）" aria-label="ひとこと">
      <div class="fbbtns">
        <button class="fbv" type="button" data-vote="good">👍 わかりやすい</button>
        <button class="fbv" type="button" data-vote="bad">👎 わかりにくい</button>
      </div>
      <p class="fbdone" id="fbDone" hidden>ありがとう！</p>
    </div>`;
}
// TOP の 10問チャレンジ
// レベル別チャレンジのボタン（TOP と /challenge/ で使う）
function challengeButtons() {
  return [1, 2, 3].map((l) => `<div class="chbtn"><a class="btn primary big" href="${href('/challenge/')}" data-start-challenge="${l}">${LV[l]}チャレンジ</a><p class="best" data-best="${l}" hidden></p></div>`).join('\n    ');
}
function challengeTopMarkup() {
  const c = config.CHALLENGE;
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const ranks = config.RANKS;
  const top = (l) => ranks[c.rankTable[l][c.rankTable[l].length - 1]];
  return `${whoMarkup()}
<section class="card challenge">
  <h2 class="cath">${c.count}問チャレンジ</h2>
  <p class="chlead">${c.count}問とくと、きみの<b>級</b>が決まる！</p>
  <p class="ladder">${ranks.map((r) => `<span>${r.emoji}${esc(r.name)}</span>`).join('<i>→</i>')}</p>
  <p class="hint" style="margin-bottom:10px">${LV[1]}で${c.count}点なら ${top(1).emoji}${esc(top(1).name)}。${LV[3]}で${c.count}点なら…${top(3).emoji}<b>${esc(top(3).name)}</b>！ ランクは点で決まるよ。タイムは「はやさ ★」で出るよ（もくひょうタイム内なら ★★★。もくひょう ${LV[1]} ${mmss(c.timeLimit[1])}・${LV[2]} ${mmss(c.timeLimit[2])}・${LV[3]} ${mmss(c.timeLimit[3])}）。◎=1点、○=0.5点で${c.count}点まんてん。${config.FEEDBACK_ENDPOINT ? 'ベストきろくを<a href="#ranking">ランキング</a>にとうろくして、チームのトップをねらえ！' : ''}</p>
  <div class="chbtns">
    ${challengeButtons()}
  </div>
</section>`;
}
// TOP のレベル別ランキング（中身は app.js が GAS から取って描く。FEEDBACK_ENDPOINT が無いときは出さない）
function rankingMarkup() {
  if (!config.FEEDBACK_ENDPOINT) return '';
  return `<section class="card ranking" id="ranking">
  <h2 class="cath">ランキング</h2>
  <p class="hint">${config.CHALLENGE.count}問チャレンジのあとに「ランキングにとうろく」した人のベストきろく（レベルごとにトップ${RANKING_TOP}人）。</p>
  <div class="rankcols">
    ${[1, 2, 3].map((l) => `<div class="rankcol"><h3>${LV[l]}</h3><ol data-ranking="${l}"><li class="hint">よみこみ中…</li></ol></div>`).join('\n    ')}
  </div>
</section>`;
}
const RANKING_TOP = 10;

function layout({ title, description, pathname, body, ogImage, ogType = 'website', h1site = false, extraHead = '' }) {
  const fullTitle = pathname === '/' ? `${config.SITE_NAME}｜${config.TAGLINE}` : `${title}｜${config.SITE_NAME}`;
  const image = ogImage || '/og/default.png';
  const siteTitle = `${esc(config.SITE_NAME)} <small>${esc(config.TAGLINE)}</small>`;
  return `<!doctype html>
<html lang="${config.LANG}" data-base="${esc(BASE)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${config.NOINDEX ? '<meta name="robots" content="noindex,nofollow">' : ''}
<script>window.PD_CONFIG=${JSON.stringify(clientConfig())};(function(){try{var p=PD_CONFIG.passcode;if((p&&localStorage.getItem('pd-pass')!==p)||!localStorage.getItem('pd-name'))document.documentElement.classList.add('locked');}catch(e){}})();</script>
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(abs(pathname))}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${esc(config.SITE_NAME)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(abs(pathname))}">
<meta property="og:image" content="${esc(abs(image))}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="ja_JP">
<meta name="author" content="${esc(config.OWNER_NAME)}">${ogType === 'article' ? `
<meta property="article:author" content="${esc(config.OWNER_NAME)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(fullTitle)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(abs(image))}">
<link rel="icon" href="${href('/favicon.svg')}" type="image/svg+xml">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@500;800&display=swap">
<link rel="stylesheet" href="${href('/style.css')}">
${analyticsTag()}
${adsenseTag()}
${extraHead}
</head>
<body>
${gateMarkup()}
<div class="wrap">
  <header class="top">
    ${h1site ? `<h1>${siteTitle}</h1>` : `<div class="h1"><a href="${href('/')}">${siteTitle}</a></div>`}
    <a class="btn ghost" href="${href('/')}">TOP</a>
  </header>
  <main id="app">
${body}
  </main>
  <footer class="foot">
    <p>青＝味方、赤＝相手、黄色のふちどり＝きみ。せめる方向は上向き（ディフェンスの問題は自分のゴールが下）。おうぎ＝体の向き（黄色のおうぎは正しい向き）、太いやじるし＋ボール＝ファーストタッチ。</p>
    <nav aria-label="サイトのリンク">
      <a href="${href('/')}">TOP</a>
      <a href="${href('/words/')}">サッカーのことば</a>
${config.HIDE_INFO_PAGES ? '' : `      <a href="${href('/about/')}">コーチについて</a>
      <a href="${href('/privacy/')}">プライバシーポリシー</a>
      <a href="${href('/contact/')}">お問い合わせ</a>`}
    </nav>
    <p>© ${config.PUBLISHED_YEAR} ${esc(config.SITE_NAME)}（作った人：${config.HIDE_INFO_PAGES ? esc(config.OWNER_NAME) : `<a href="${href('/about/')}">${esc(config.OWNER_NAME)}</a>`}）</p>
  </footer>
</div>
<script src="${href('/app.js')}" defer></script>
</body>
</html>
`;
}

/* ===================== 問題ページ ===================== */
function questionPage(q) {
  const prev = QUESTIONS[q.id - 2], next = QUESTIONS[q.id] || QUESTIONS[0];
  const correct = q.options.map((o, i) => (o.ok ? i : -1)).filter((i) => i >= 0);
  const description = `${q.q} せいかいは${correct.length}つ。${LV[q.level]}・${q.phase}・${q.pos}の問題。答えと理由、動きを図でかいせつ。`.slice(0, 150);
  const head = (sub) => `<div class="qno"><span class="catname">全${QUESTIONS.length}問</span>　<span class="qpos">${sub}</span>　<span class="qid">Q${q.id}</span></div>`;
  // 用語の下線は画面（問題 / 答え）ごとに初出だけ。選択肢ボタンの中には付けない（ボタンの中にボタンは置けない）
  const seenQ = new Set(), seenA = new Set();
  const body = `
<article data-qid="${q.id}" data-level="${q.level}" data-phase="${esc(q.phase)}" data-pos="${esc(q.pos)}" data-title="${esc(q.title)}">
  <section id="qview">
    <div class="card">
      ${head('')}
      ${badges(q)}
      <h1 class="qtitle">${markTerms(q.title, seenQ)}</h1>
      ${renderScene(q.scene, null, 'q' + q.id)}
      ${legend(q)}
      <p class="qtext">${markTerms(q.q, seenQ)}</p>
      ${wordsBox(q)}
      <p class="hint">正しいと思うものを全部えらぼう（1〜3つ）。</p>
      <div class="choices" role="group" aria-label="こたえのえらびかた">
        ${q.options.map((o, i) => `<button class="choice" type="button" role="checkbox" aria-checked="false" data-i="${i}" data-ok="${o.ok ? 1 : 0}"><span class="k">${KEYS[i]}</span><span>${esc(o.text)}</span></button>`).join('\n        ')}
      </div>
      <noscript><p class="hint">答え合わせには JavaScript がいります。</p></noscript>
      <div class="actions">
        <button class="primary" id="btnAnswer" type="button" disabled>答え合わせ</button>
        <a class="btn" href="${href(qpath(next.id))}" data-next data-skip>べつの問題</a>
      </div>
    </div>
  </section>
  <section id="aview" hidden>
    <div class="card">
      ${head('答え')}
      ${badges(q)}
      <div class="qtitle">${markTerms(q.title, seenA)}</div>
      <div id="result" class="result"></div>
      <div class="point"><b>ポイント</b>　${markTerms(q.point, seenA)}</div>
    </div>
    ${q.options.map((o, i) => `
    <div class="ans ${o.ok ? 'ok' : 'ng'}" data-i="${i}">
      <div class="head"><span class="mark">${o.ok ? '○' : '×'}</span><span style="flex:1;min-width:0">${KEYS[i]}　${markTerms(o.text, seenA)}</span><span class="you" hidden>きみの答え</span></div>
      <p class="why">${markTerms(o.why, seenA)}</p>
      ${o.ok && o.a ? renderScene(q.scene, o.a, 'a' + q.id + '-' + i) : ''}
    </div>`).join('')}
    ${feedbackMarkup()}
    ${adSlot('answer-bottom', 'かいせつを読み終えたあと、「つぎの問題」ボタンの上')}
    <div class="actions">
      <a class="btn primary" href="${href(qpath(next.id))}" data-next>つぎの問題</a>
      <button id="btnRetry" type="button">もう一回</button>
      <a class="btn" href="${href('/')}">TOPへ</a>
    </div>
  </section>
  <nav class="pn" aria-label="前の問題・次の問題">
    ${prev ? `<a href="${href(qpath(prev.id))}" rel="prev">← Q${prev.id} ${esc(prev.title)}</a>` : '<span></span>'}
    ${QUESTIONS[q.id] ? `<a href="${href(qpath(next.id))}" rel="next">Q${next.id} ${esc(next.title)} →</a>` : '<span></span>'}
  </nav>
</article>`;
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'Quiz', name: `Q${q.id} ${q.title}`, description, inLanguage: 'ja',
    educationalLevel: LV[q.level], audience: { '@type': 'EducationalAudience', educationalRole: 'student' },
    about: `サッカー ${q.phase} ${q.pos} ${q.situ} ポジショニング`,
    author: { '@type': 'Person', name: config.OWNER_NAME },
  };
  return layout({
    title: `Q${q.id} ${q.title}`, description, pathname: qpath(q.id), body, ogType: 'article',
    ogImage: `/og/q-${qid(q.id)}.png`,
    extraHead: `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>`,
  });
}

/* ===================== TOP / カテゴリページ ===================== */
function catButton(c, extraClass = '') {
  const list = filtered(c);
  return `<a class="cat ${c.key === 'all' ? 'all' : ''} ${extraClass}" href="${href(c.key === 'all' ? '#list' : catPath(c))}" data-ids="${list.map((q) => q.id).join(',')}" data-label="${esc(c.label)}"><span class="cl">${esc(c.label)}</span><span class="cn">${list.length} 問</span></a>`;
}
function questionList(list, label) {
  return `<div class="list" data-list-ids="${list.map((q) => q.id).join(',')}" data-list-label="${esc(label)}">
    ${list.map((q) => `<a class="item" href="${href(qpath(q.id))}" data-q="${q.id}"><span class="n"><span class="mk"></span><br>Q${q.id}</span><span class="t">${esc(q.title)}<small>${LV[q.level]}・${esc(q.phase)}・${esc(q.pos)}・${esc(q.situ)}</small></span></a>`).join('\n    ')}
  </div>`;
}

function indexPage() {
  const body = `
${challengeTopMarkup()}
${rankingMarkup()}
<details class="card fold" id="practice" data-fold="practice">
  <summary><h2 class="cath">練習する</h2><small>カテゴリをえらんで、1問ずつ</small></summary>
  <p class="intro">カテゴリをえらぼう。えらんだカテゴリの問題が、1問ずつランダムに出てくる（点数やタイムはなし。すきなだけできる）。<span class="hint">（全 ${QUESTIONS.length} 問・せいかい <span id="doneAll">0</span> 問）</span></p>
${CATS.map((g) => `
  <section class="catgroup">
    ${g.group ? `<h3 class="cath">${esc(g.group)}</h3>` : ''}
    <div class="catrow">
      ${g.items.map((c) => catButton(c)).join('\n      ')}
    </div>
  </section>`).join('')}
</details>
<details class="card fold" id="about-site" data-fold="about">
  <summary><h2 class="cath">このサイトについて</h2><small>あそび方と、おうちの人へ</small></summary>
  <p class="about-site">${esc(config.SITE_DESCRIPTION)} ピッチ図の青は味方、赤は相手、黄色のふちどりが「きみ」。ボールの場所と味方・相手のいる場所を見て、「つぎ、どこへ動く？」を考えよう。せいかいは1つとはかぎらない（1〜3つ）。答え合わせをすると、せいかいの動きがやじるしつきの図で、ちがう答えには理由がつく。中級からは「体の向き」（おうぎの形）、上級からは「ファーストタッチ」（太いやじるしとボール）も考える。わからないことばは <a href="${href('/words/')}">サッカーのことば</a> で調べられる。</p>
  <p class="about-site">コーチやおうちの人へ：練習前の5分、車の中、しあいの前の日など、短い時間で「考えるくせ」をつけるために作った問題集です。${config.HIDE_INFO_PAGES ? '問題についてのご意見は、コーチにちょくせつ教えてください。' : `問題についてのご意見は <a href="${href('/contact/')}">お問い合わせ</a> からどうぞ。`}</p>
</details>
<details class="card fold" id="list" data-fold="list">
  <summary><h2 class="cath">問題リスト</h2><small>全 ${QUESTIONS.length} 問。番号からえらぶ</small></summary>
  <p class="hint" style="margin-bottom:10px">◎は全部せいかいした問題、○はやってみた問題。</p>
  ${questionList(QUESTIONS, '全部の問題から')}
</details>
${adSlot('home-bottom', 'TOPページの問題一覧の下')}`; // kanji-ok
  const jsonld = { '@context': 'https://schema.org', '@type': 'WebSite', name: config.SITE_NAME, url: abs('/'), description: config.SITE_DESCRIPTION, inLanguage: 'ja', author: { '@type': 'Person', name: config.OWNER_NAME } };
  return layout({ title: config.SITE_NAME, description: config.SITE_DESCRIPTION, pathname: '/', body, h1site: true,
    extraHead: `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` });
}

function categoryPage(c) {
  const list = filtered(c);
  const title = `${c.group}：${c.label}の問題（${list.length}問）`;
  const description = `${c.group}が「${c.label}」のポジショニング問題 ${list.length} 問。${config.SITE_DESCRIPTION}`.slice(0, 150);
  const body = `
<nav class="hint" aria-label="パンくず"><a href="${href('/')}">TOP</a> › ${esc(c.group)} › ${esc(c.label)}</nav>
<h1 class="qtitle">${esc(title)}</h1>
<div class="home-actions">
  ${catButton(c, 'btn primary')}
  <a class="btn" href="${href('/')}">カテゴリをえらび直す</a>
</div>
<div class="card">
  <p class="hint" style="margin-bottom:10px">「${esc(c.label)}」の問題 ${list.length} 問。◎は全部せいかいした問題、○はやってみた問題。</p>
  ${questionList(list, c.label)}
</div>
${adSlot('list-bottom', 'カテゴリページの問題一覧の下')}`; // kanji-ok
  return layout({ title, description, pathname: catPath(c), body });
}

/* ===================== サッカーのことば（用語の一覧） ===================== */
function wordsPage() {
  const sorted = [...TERMS].sort((a, b) => a.t.localeCompare(b.t, 'ja'));
  const body = `
<nav class="hint" aria-label="パンくず"><a href="${href('/')}">TOP</a> › サッカーのことば</nav>
<h1 class="qtitle">サッカーのことば（${TERMS.length} 語）</h1>
<p class="hint">問題に出てくることばの意味。問題のページでは、点線の下線がついたことばをタップしても見られる。</p>
<div class="card">
  <dl class="wordlist">
    ${sorted.map((t) => `<div id="w-${t.id}"><dt>${esc(t.t)}${t.alt && t.alt.length ? `<small>（${t.alt.map(esc).join('・')}）</small>` : ''}</dt><dd>${esc(t.d)}</dd></div>`).join('\n    ')}
  </dl>
</div>
<div class="actions"><a class="btn" href="${href('/')}">TOPへ</a></div>`;
  return layout({ title: 'サッカーのことば', description: `問題に出てくるサッカーのことば ${TERMS.length} 語の、かんたんな意味。`, pathname: '/words/', body });
}

/* ===================== 固定ページ ===================== */
function staticPage(file) {
  let html = fs.readFileSync(path.join(SRC, 'pages', file), 'utf8');
  const m = html.match(/^<!--\s*title:\s*(.*?)\s*\|\s*description:\s*(.*?)\s*-->\s*/);
  if (!m) throw new Error(`${file}: 先頭に <!-- title: ... | description: ... --> が必要`); // kanji-ok
  html = html.slice(m[0].length);
  html = html.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (k === 'CONTACT_FORM') return config.CONTACT_FORM_URL ? `<p><a class="btn primary" href="${esc(config.CONTACT_FORM_URL)}" target="_blank" rel="noopener">お問い合わせフォームを開く</a></p>` : '';
    if (k === 'ADSENSE_NOTE') return isPlaceholder(config.ADSENSE_CLIENT) ? '' : '<p>当サイトは Google AdSense を利用して広告を配信しています。</p>'; // kanji-ok
    if (!(k in config)) throw new Error(`${file}: 未定義のプレースホルダ {{${k}}}`); // kanji-ok
    return esc(config[k]);
  });
  const slug = file.replace(/\.html$/, '');
  return { pathname: `/${slug}/`, html: layout({ title: m[1], description: m[2], pathname: `/${slug}/`, body: `<article class="prose">\n${html}\n</article>` }) };
}

/* ===================== OGP画像（PNG） ===================== */
async function makeOgRenderer() {
  let Resvg;
  try { ({ Resvg } = await import('@resvg/resvg-js')); }
  catch { console.warn('  [注意] @resvg/resvg-js が無いので OGP画像（PNG）は作らない。`npm install` で入る。'); return null; } // kanji-ok
  const fontDir = path.join(SRC, 'assets', 'fonts');
  const fontFiles = fs.existsSync(fontDir) ? fs.readdirSync(fontDir).filter((f) => /\.(ttf|otf)$/i.test(f)).map((f) => path.join(fontDir, f)) : [];
  if (!fontFiles.length) console.warn('  [注意] src/assets/fonts にフォントが無い。OGP画像の日本語が崩れることがある。'); // kanji-ok
  const cacheDir = path.join(ROOT, '.og-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  return (svg) => {
    const key = createHash('sha1').update(svg).update(fontFiles.join('|')).digest('hex');
    const cached = path.join(cacheDir, key + '.png');
    if (fs.existsSync(cached)) return fs.readFileSync(cached);
    const png = new Resvg(svg, {
      fitTo: { mode: 'width', value: 1200 },
      font: { fontFiles, loadSystemFonts: fontFiles.length === 0, defaultFontFamily: 'M PLUS Rounded 1c' },
    }).render().asPng();
    fs.writeFileSync(cached, png);
    return png;
  };
}
function wrapText(s, n) { const out = []; for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n)); return out.slice(0, 4); }
function ogSvg({ scene, overlay, title, sub, id }) {
  const C = OG_COLORS;
  const lines = wrapText(title, 9);
  const fs0 = lines.length >= 3 ? 40 : 44;
  const pitch = renderScene(scene, overlay, id, C, 'x="40" y="40" width="660" height="550"');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f6f8f3"/>
  <rect x="40" y="40" width="660" height="550" rx="18" fill="#46a052"/>
  ${pitch}
  <g font-family="${C.font}" font-weight="800">
    ${lines.map((l, i) => `<text x="740" y="${140 + i * (fs0 + 12)}" font-size="${fs0}" fill="#1f2a22">${esc(l)}</text>`).join('')}
    ${[].concat(sub).map((l, i) => `<text x="740" y="${140 + lines.length * (fs0 + 12) + 10 + i * 34}" font-size="24" fill="#5e6b62" font-weight="500">${esc(l)}</text>`).join('')}
    <text x="740" y="540" font-size="30" fill="#1f7a3a">${esc(config.SITE_NAME)}</text>
    <text x="740" y="578" font-size="20" fill="#5e6b62" font-weight="500">${esc(config.TAGLINE)}</text>
  </g>
</svg>`;
}

/* ===================== 書き出し ===================== */
function write(rel, content) {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#1f7a3a"/><circle cx="32" cy="32" r="18" fill="#fff"/><path d="M32 18l8 6-3 9h-10l-3-9z" fill="#1f2a22"/><circle cx="32" cy="32" r="18" fill="none" stroke="#1f2a22" stroke-width="2"/></svg>`;

async function main() {
  const t0 = Date.now();
  if (!/^https?:\/\//.test(config.SITE_URL) || /example\.com/.test(config.SITE_URL)) {
    console.warn('  [注意] site.config.mjs の SITE_URL が仮のまま（' + config.SITE_URL + '）。公開前に独自ドメインへ変えること。'); // kanji-ok
  }
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  const urls = [];
  const add = (pathname, priority) => urls.push({ loc: abs(pathname), priority });

  // 問題ページ
  for (const q of QUESTIONS) { write(`q/${qid(q.id)}/index.html`, questionPage(q)); add(qpath(q.id), '0.8'); }
  // TOP・カテゴリ
  write('index.html', indexPage()); add('/', '1.0');
  for (const c of ALL_CATS.filter((c) => c.slug)) { write(`c/${c.slug}/index.html`, categoryPage(c)); add(catPath(c), '0.6'); }
  // 固定ページ（HIDE_INFO_PAGES のあいだは作らない。URL を直接たたいても 404）
  if (!config.HIDE_INFO_PAGES) {
    for (const f of fs.readdirSync(path.join(SRC, 'pages')).filter((f) => f.endsWith('.html'))) {
      const p = staticPage(f); write(p.pathname.slice(1) + 'index.html', p.html); add(p.pathname, '0.3');
    }
  }
  // 10問チャレンジ（進行・結果は端末側 app.js で描く）
  write('challenge/index.html', layout({ title: `${config.CHALLENGE.count}問チャレンジ`, description: `レベルをえらんでランダムに${config.CHALLENGE.count}問。◎=1点、○=0.5点、タイムも計る。何級までいけるかな？`, pathname: '/challenge/',
    body: `${whoMarkup()}<div id="challenge" data-page="challenge"><div class="card challenge"><h1 class="qtitle">${config.CHALLENGE.count}問チャレンジ</h1><p class="hint">レベルをえらんでね。ランダムに${config.CHALLENGE.count}問、◎=1点、○=0.5点。タイムも計るよ。</p><div class="chbtns" id="chLevels">${challengeButtons()}</div><div class="actions" style="justify-content:center"><a class="btn" href="${href('/')}">TOPへ</a></div><noscript><p class="hint">チャレンジには JavaScript がいります。</p></noscript></div></div>`,
    extraHead: '<meta name="robots" content="noindex">' }));
  // サッカーのことば（用語の一覧）
  write('words/index.html', wordsPage()); add('/words/', '0.4');
  // 404
  write('404.html', layout({ title: 'ページが見つかりません', description: 'ページが見つかりません', pathname: '/404.html',
    body: `<div class="card"><h1 class="qtitle">ページが見つかりません</h1><p>そのページはありません。<a href="${href('/')}">TOP</a> から問題をえらんでください。</p></div>`,
    extraHead: '<meta name="robots" content="noindex">' }));
  // 静的ファイル
  write('style.css', fs.readFileSync(path.join(SRC, 'style.css')));
  write('app.js', fs.readFileSync(path.join(SRC, 'app.js')));
  write('favicon.svg', favicon);
  const pub = path.join(SRC, 'public');
  if (fs.existsSync(pub)) fs.cpSync(pub, DIST, { recursive: true });
  // sitemap / robots
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
    + urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${config.LAST_UPDATED}</lastmod><priority>${u.priority}</priority></url>`).join('\n')
    + `\n</urlset>\n`);
  write('robots.txt', config.NOINDEX ? `User-agent: *\nDisallow: /\n` : `User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`);

  // OGP画像
  const toPng = process.argv.includes('--no-og') ? null : await makeOgRenderer();
  if (toPng) {
    for (const q of QUESTIONS) {
      const svg = ogSvg({ scene: q.scene, overlay: null, title: q.title, sub: [`Q${q.id}　${LV[q.level]}・${q.phase}`, `${q.pos}・${q.situ}`], id: 'og' + q.id });
      if (process.env.OG_SVG) write(`og/q-${qid(q.id)}.svg`, svg);
      write(`og/q-${qid(q.id)}.png`, toPng(svg));
    }
    const q1 = QUESTIONS[0];
    write('og/default.png', toPng(ogSvg({ scene: q1.scene, overlay: null, title: config.TAGLINE, sub: `小学生向け・全${QUESTIONS.length}問`, id: 'ogd' })));
  }

  console.log(`dist/ に ${QUESTIONS.length} 問 + カテゴリ ${ALL_CATS.length - 1} ページ + 固定ページを生成（${Date.now() - t0}ms）`); // kanji-ok
}
main().catch((e) => { console.error(e); process.exit(1); });
