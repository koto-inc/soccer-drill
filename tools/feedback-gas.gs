/**
 * ポジショニングドリル 受け口（Google Apps Script）
 *   - 👍👎 フィードバックの記録（doPost, type:'feedback' → シート 'feedback'）
 *   - チャレンジ結果の記録（doPost, type:'result' → シート 'results'）
 *   - 1問ごとの答えログ（doPost, type:'answer' → シート 'answers'。問題を直すためのデータ。doGet では返さない）
 *   - 名前ごとのレベル別ベスト（doGet ?name=... → JSON）、ランキング（doGet ?ranking=1 → JSON）
 *   - 👎 の一覧（feedback の 👎 を シート 'badlist' にも1人×1問で1行。手で rebuildBadlist を実行すると過去分から作り直せる）
 *   - 送信・取得のすべてに key（API_KEY と同じ文字列）が必要。違えば {ok:false,error:'forbidden'}
 *   - セルに書く文字列の先頭が = + - @ なら空白を足して、数式として実行されないようにする
 *
 * 使い方（README「👍👎・チャレンジ結果の受け口」も参照）
 * 1. 保存先のスプレッドシートを開く（SPREADSHEET_ID のシート。別のシートにしたいときは ID を書きかえる）
 * 2. メニュー「拡張機能」→「Apps Script」を開き、Code.gs の中身をこのファイルの内容で置きかえて保存
 * 3. 右上「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *      説明: feedback / 次のユーザーとして実行: 自分 / アクセスできるユーザー: 全員
 *    →「デプロイ」。初回は権限の承認が出るので許可する
 * 4. 表示された「ウェブアプリの URL」（https://script.google.com/macros/s/.../exec）を
 *    site.config.mjs の FEEDBACK_ENDPOINT に貼って `npm run build`
 * 5. コードを直したら「デプロイ」→「デプロイを管理」→ 鉛筆 → バージョン「新バージョン」→ デプロイ（URL は変わらない）
 *
 * ---- doPost（サイト側は navigator.sendBeacon(url, Blob(JSON文字列, 'text/plain'))。使えなければ fetch POST no-cors keepalive）----
 *   すべての送信に key を含める（site.config.mjs の FEEDBACK_KEY）。
 *   type:'feedback' { type, key, name, qid, vote:'good'|'bad', comment, reasons:[👎の理由チップの文字列], level, phase, pos, device('スマホ'|'タブレット'|'PC'。ua 列に入る), ts }
 *                                                                                                  → 'feedback' シート
 *   type:'result'   { type, key, name, level:1|2|3, score(7点満点。1問 ＝ 正解のぶん − 0.5×まちがいの数 − 30秒超過0.5、下限0), timeSec, rank(ランク名), rankIdx, cleared(30秒をこえた問題が1つも無ければ true),
 *                     qids:[出た問題のID], marks:'◎○×…'(問題数ぶんの文字), ts }                   → 'results' シート
 *   type:'answer'   { type, key, name, qid, level, phase, pos, picked:[押した選択肢の添字 0〜4], correct:[正解の添字],
 *                     result:'ok'|'partial'|'ng', timeSec(問題表示→答え合わせ), attempt(同じ問題で何回目か),
 *                     mode:'challenge'|'practice', ts }                                            → 'answers' シート
 *   type:'rank'     { type, key, name, level, score, timeSec, rank, rankIdx, ts }（結果ページで「ランキングにとうろく」を押したとき）
 *                                                                                                  → 'ranking' シート
 *   type が無いものは feedback として扱う（古いサイトからの送信）。返事: {ok:true} / {ok:false,error}
 *   feedback は同じ name+qid の行が複数来ることがある（👎 のあとに理由チップを足すと送り直す）→ いちばん下の行が最新。👎 は badlist にも反映（同じ name+qid は更新、👍 に変わっても消さない）
 *   ヘッダーは足りない列（例: 古い feedback シートの 'reasons'）を末尾に書き足すだけで、既存の列は動かさない
 *
 * ---- doGet（サイト側は fetch(url + '?name=' + encodeURIComponent(name) + '&key=' + key) → JSON。key が無いか違えば forbidden）----
 *   その name の 'results' からレベル別のベスト（score が最大、同点なら timeSec が短い）を返す:
 *     { "1": { "score": 5.5, "time": 150, "rank": "少年サッカーエース級", "cleared": true, "ts": "2026-10-25T…" }, "2": {…}, "3": {…} }
 *   記録が無いレベルは入らない。name が空なら {}。名前の一覧や他の人の記録は返さない。
 *   ?ranking=1 は例外で、「ランキングにとうろく」した人のなまえ・点・タイム・ランクだけを、レベルごとに上位 RANKING_TOP 人返す
 *   （60秒キャッシュ。とうろくがあったときはキャッシュを消す）。
 */
// 保存先のスプレッドシート（URL の /d/ と /edit の間の ID）。空ならこのスクリプトが貼られているシートに保存する
// サイトとの共通キー（site.config.mjs の FEEDBACK_KEY と同じ文字列）。空なら照合しない。違うキーの送信・取得は受け付けない
var API_KEY = 'uiJU7xMjpPRvn2oYnakg';

var SPREADSHEET_ID = '1UuAX2vNxlX5qw1t5MUyPKB52Tl9fp59Z5gY7KJXVsN0';

var SHEETS = {
  feedback: { name: 'feedback', header: ['受信日時', 'ts(端末)', 'name', 'qid', 'vote', 'comment', 'level', 'phase', 'pos', 'ua', 'reasons'] },
  result:   { name: 'results',  header: ['受信日時', 'ts(端末)', 'name', 'level', 'score', 'timeSec', 'rank', 'rankIdx', 'cleared', 'qids', 'marks'] },
  answer:   { name: 'answers',  header: ['受信日時', 'ts(端末)', 'name', 'qid', 'level', 'phase', 'pos', 'picked', 'correct', 'result', 'timeSec', 'attempt', 'mode'] },
  rank:     { name: 'ranking',  header: ['受信日時', 'ts(端末)', 'name', 'level', 'score', 'timeSec', 'rank', 'rankIdx'] },
};
var RANKING_TOP = 10;   // ランキングに出す人数（レベルごと）
var RANKING_CACHE_SEC = 60;
// 1回のチャレンジの問題数（site.config.mjs の CHALLENGE.count と同じにする）。
// これより多い問題数で記録された行（10問時代）は、marks の最初の CHALLENGE_COUNT 問だけで点を計算し直し、タイムは問題数の比で縮める
var CHALLENGE_COUNT = 7;

function getSpreadsheet_() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}
function getSheet_(type) {
  var def = SHEETS[type] || SHEETS.feedback;
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(def.name) || ss.insertSheet(def.name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(def.header);
    sh.getRange(1, 1, 1, def.header.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < def.header.length) {
    // 列が増えたとき（例: feedback の 'reasons'）: 既存の列はそのまま、足りないヘッダーだけ末尾に書き足す
    var from = sh.getLastColumn();
    var add = def.header.slice(from);
    sh.getRange(1, from + 1, 1, add.length).setValues([add]).setFontWeight('bold');
  }
  return sh;
}
function joinList_(v, max) { return (Array.isArray(v) ? v.map(String) : [String(v || '')]).filter(Boolean).join(',').slice(0, max || 200); }
function row_(a) { return a.map(function (v) { return typeof v === 'string' ? cell_(v) : v; }); }
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
// セルに書く文字列の先頭が = + - @ だと Google スプレッドシートが数式として実行してしまう（数式インジェクション）。先頭に空白を足して文字のままにする
function cell_(s) { s = String(s == null ? '' : s); return /^[=+\-@]/.test(s) ? ' ' + s : s; }
// サイトから送られた key が API_KEY と同じか（API_KEY が空なら照合しない）
function keyOk_(k) { return !API_KEY || String(k || '') === API_KEY; }
function cleanName_(s) { return cell_(String(s || '').replace(/\s+/g, ' ').trim().slice(0, 12)); }
function scoreOfMarks_(marks) { var s = 0; for (var i = 0; i < marks.length; i++) { if (marks[i] === '◎') s += 1; else if (marks[i] === '○') s += 0.5; else if (marks[i] === '×') s -= 0.5; } return Math.max(0, s); }   // 10問時代の記録を今の問題数に合わせるための近似。今のルール（まちがいの数と30秒超過で減点）はシートの marks からは分からないので、× を -0.5 とみなす
// 問題数を変える前の記録を、今の問題数に合わせる。marks（◎○×の列）があれば最初の CHALLENGE_COUNT 問で計算し直し、
// 無ければ点とタイムを問題数の比で縮める（点は 0.5 きざみに切り捨て）
function adjust_(score, time, marks) {
  marks = String(marks || '');
  if (marks.length > CHALLENGE_COUNT) {
    return { score: scoreOfMarks_(marks.slice(0, CHALLENGE_COUNT)), time: Math.round(time * CHALLENGE_COUNT / marks.length) };
  }
  if (!marks && score > CHALLENGE_COUNT) {
    var oldCount = 10;
    return { score: Math.floor(score * CHALLENGE_COUNT / oldCount * 2) / 2, time: Math.round(time * CHALLENGE_COUNT / oldCount) };
  }
  return { score: score, time: time };
}
// results シートから「name+level+score+timeSec が同じ行」の marks を引く（ranking シートには marks が無いので）
function marksIndex_() {
  var idx = {};
  var sh = getSpreadsheet_().getSheetByName(SHEETS.result.name);
  if (!sh || sh.getLastRow() < 2) return idx;
  var h = SHEETS.result.header, c = function (k) { return h.indexOf(k); };
  sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues().forEach(function (r) {
    idx[[cleanName_(r[c('name')]), Number(r[c('level')]), Number(r[c('score')]) || 0, Number(r[c('timeSec')]) || 0].join('|')] = String(r[c('marks')] || '');
  });
  return idx;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var body = (e && e.postData && e.postData.contents) || '{}';
    var d = JSON.parse(body);
    if (!keyOk_(d.key)) return json_({ ok: false, error: 'forbidden' });
    var type = d.type === 'result' ? 'result' : d.type === 'answer' ? 'answer' : d.type === 'rank' ? 'rank' : 'feedback';
    var sh = getSheet_(type);
    if (type === 'rank') {
      sh.appendRow(row_([
        new Date(), d.ts || '', cleanName_(d.name), Number(d.level) || '', Number(d.score) || 0, Number(d.timeSec) || 0,
        String(d.rank || '').slice(0, 30), Number(d.rankIdx) || 0
      ]));
      CacheService.getScriptCache().remove('ranking');   // すぐランキングに出るように
    } else if (type === 'answer') {
      sh.appendRow(row_([
        new Date(), d.ts || '', cleanName_(d.name), Number(d.qid) || '', Number(d.level) || '', String(d.phase || '').slice(0, 30), String(d.pos || '').slice(0, 30),
        joinList_(d.picked, 20), joinList_(d.correct, 20), String(d.result || '').slice(0, 10), Number(d.timeSec) || 0, Number(d.attempt) || 0,
        String(d.mode || '').slice(0, 10)
      ]));
    } else if (type === 'result') {
      sh.appendRow(row_([
        new Date(), d.ts || '', cleanName_(d.name), Number(d.level) || '', Number(d.score) || 0, Number(d.timeSec) || 0,
        String(d.rank || '').slice(0, 30), Number(d.rankIdx) || 0, d.cleared ? true : false,
        Array.isArray(d.qids) ? d.qids.join(',') : String(d.qids || ''), String(d.marks || '').slice(0, 20)
      ]));
    } else {
      sh.appendRow(row_([
        new Date(), d.ts || '', cleanName_(d.name), d.qid || '', d.vote || '', String(d.comment || '').slice(0, 200),
        d.level || '', d.phase || '', d.pos || '', String(d.device || '').slice(0, 20) /* 端末の種類（スマホ／タブレット／PC）。UA の生の文字列は送られてこない。列名は ua のまま */, joinList_(d.reasons, 200)
      ]));
      updateBadlist_(d);   // 👎 なら badlist に追記（同じ name+qid は更新。👍 に変わっても消さない）
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// ?ranking=1 → レベル別ランキング（「ランキングにとうろく」した記録だけ。名前ごとのベストを上位 RANKING_TOP 人）
//   { "1": [ { "name": "たくま", "score": 7, "time": 150, "rank": "高校サッカー級", "rankIdx": 3 }, … ], "2": [...], "3": [...] }（?ranking=1&key=… で取る）
// ?name=...   → その名前のレベル別ベスト（端末をまたいで最高記録を出すため）
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!keyOk_(p.key)) return json_({ ok: false, error: 'forbidden' });
  if (p.ranking) return json_(ranking_());
  var name = cleanName_(p.name);
  if (!name) return json_({});
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(SHEETS.result.name);
  if (!sh || sh.getLastRow() < 2) return json_({});
  var header = SHEETS.result.header;
  var col = function (k) { return header.indexOf(k); };
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, header.length).getValues();
  var best = {};
  rows.forEach(function (r) {
    if (cleanName_(r[col('name')]) !== name) return;
    var level = Number(r[col('level')]); if (!level) return;
    var a = adjust_(Number(r[col('score')]) || 0, Number(r[col('timeSec')]) || 0, r[col('marks')]);
    var score = a.score, time = a.time;
    var cur = best[level];
    if (!cur || score > cur.score || (score === cur.score && time < cur.time)) {
      var ts = r[col('ts(端末)')];
      best[level] = { score: score, time: time, rank: String(r[col('rank')] || ''), cleared: r[col('cleared')] === true || r[col('cleared')] === 'TRUE',
        ts: ts instanceof Date ? ts.toISOString() : String(ts || '') };
    }
  });
  return json_(best);
}

function ranking_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('ranking');
  if (hit) return JSON.parse(hit);
  var out = { 1: [], 2: [], 3: [] };
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(SHEETS.rank.name);
  if (sh && sh.getLastRow() >= 2) {
    var header = SHEETS.rank.header;
    var col = function (k) { return header.indexOf(k); };
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, header.length).getValues();
    var midx = null;   // 10問時代の行の marks を results から引くための索引（必要になったときだけ作る）
    var best = {};   // level -> name -> record
    rows.forEach(function (r) {
      var name = cleanName_(r[col('name')]), level = Number(r[col('level')]);
      if (!name || !out[level]) return;
      var score = Number(r[col('score')]) || 0, time = Number(r[col('timeSec')]) || 0;
      if (score > CHALLENGE_COUNT) {   // 問題数を変える前の記録 → 最初の CHALLENGE_COUNT 問で計算し直す
        if (!midx) midx = marksIndex_();
        var a = adjust_(score, time, midx[[name, level, score, time].join('|')] || '');
        score = a.score; time = a.time;
      }
      best[level] = best[level] || {};
      var cur = best[level][name];
      if (!cur || score > cur.score || (score === cur.score && time < cur.time)) {
        best[level][name] = { name: name, score: score, time: time, rank: String(r[col('rank')] || ''), rankIdx: Number(r[col('rankIdx')]) || 0 };
      }
    });
    Object.keys(out).forEach(function (level) {
      out[level] = Object.keys(best[level] || {}).map(function (n) { return best[level][n]; })
        .sort(function (a, b) { return b.score - a.score || a.time - b.time; })
        .slice(0, RANKING_TOP);
    });
  }
  cache.put('ranking', JSON.stringify(out), RANKING_CACHE_SEC);
  return out;
}

// ---- badlist: 👎 が押された問題の一覧（1人×1問につき1行。送り直しは更新。あとで 👍 に変わっても消さない） ----
var SITE_URL = 'https://koto-inc.github.io/soccer-drill';   // 問題ページへのリンク用
var BADLIST = { name: 'badlist', header: ['最終更新', 'name', 'qid', '問題ページ', 'level', 'phase', 'pos', 'reasons', 'comment', 'ua'] };

function badlistSheet_() {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(BADLIST.name);
  if (!sh) {
    sh = ss.insertSheet(BADLIST.name);
    sh.appendRow(BADLIST.header);
    sh.getRange(1, 1, 1, BADLIST.header.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function qurl_(qid) { var n = Number(qid) || 0; return n ? SITE_URL + '/q/' + ('000' + n).slice(-3) + '/' : ''; }
function badlistRow_(d) {
  return row_([
    new Date(), cleanName_(d.name), Number(d.qid) || '', qurl_(d.qid), Number(d.level) || '', String(d.phase || '').slice(0, 30), String(d.pos || '').slice(0, 30),
    joinList_(d.reasons, 200), String(d.comment || '').slice(0, 200), String(d.device || '').slice(0, 20)
  ]);
}
// feedback 1件を badlist に反映する。vote が 'bad' のときだけ: 同じ name+qid の行があれば更新、なければ追記（'good' では何もしない）
function updateBadlist_(d) {
  var name = cleanName_(d.name), qid = Number(d.qid) || 0;
  if (!qid || d.vote !== 'bad') return;
  var sh = badlistSheet_();
  var found = 0;
  if (sh.getLastRow() >= 2) {
    var vals = sh.getRange(2, 2, sh.getLastRow() - 1, 2).getValues();   // name, qid
    for (var i = 0; i < vals.length; i++) {
      if (cleanName_(vals[i][0]) === name && Number(vals[i][1]) === qid) { found = i + 2; break; }
    }
  }
  var row = badlistRow_(d);
  if (found) sh.getRange(found, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
}
// ---- 必要なときに手で実行する（何度でも可）: feedback シートの過去の行から badlist を作り直す ----
// 普段は doPost が 👎 のたびに自動で追記するので不要。過去分を取り込むとき、行を消してしまったとき、並べ方を変えたときに使う。badlist に手で書いたメモは消えるので注意
// Apps Script エディタで rebuildBadlist を選んで「実行」。既存の badlist の中身は消して、feedback で一度でも 👎 が押された name+qid を並べる（同じ組み合わせは、いちばん下の 👎 の行の内容）
function rebuildBadlist() {
  var ss = getSpreadsheet_();
  var fb = ss.getSheetByName(SHEETS.feedback.name);
  if (!fb || fb.getLastRow() < 2) { Logger.log('feedback シートに行がありません'); return; }
  var header = fb.getRange(1, 1, 1, fb.getLastColumn()).getValues()[0].map(String);
  var c = function (k) { return header.indexOf(k); };
  var rows = fb.getRange(2, 1, fb.getLastRow() - 1, fb.getLastColumn()).getValues();
  var latest = {};   // name|qid -> いちばん下の 👎 の行
  rows.forEach(function (r) {
    var name = cleanName_(r[c('name')]), qid = Number(r[c('qid')]) || 0;
    if (!name || !qid || String(r[c('vote')]) !== 'bad') return;
    latest[name + '|' + qid] = r;
  });
  var out = [];
  Object.keys(latest).forEach(function (k) {
    var r = latest[k];
    var when = r[0] instanceof Date ? r[0] : new Date();
    var row = badlistRow_({ name: r[c('name')], qid: r[c('qid')], level: r[c('level')], phase: r[c('phase')], pos: r[c('pos')],
      reasons: c('reasons') >= 0 ? String(r[c('reasons')] || '') : '', comment: r[c('comment')], device: c('ua') >= 0 ? r[c('ua')] : '' });
    row[0] = when;
    out.push(row);
  });
  out.sort(function (a, b) { return (Number(a[2]) || 0) - (Number(b[2]) || 0) || (a[0] - b[0]); });   // 問題番号順
  var sh = badlistSheet_();
  if (sh.getLastRow() >= 2) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  if (out.length) sh.getRange(2, 1, out.length, BADLIST.header.length).setValues(out);
  Logger.log(out.length + ' 件を badlist に並べた');
}
