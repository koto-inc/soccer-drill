/**
 * ポジショニングドリル 受け口（Google Apps Script）
 *   - 👍👎 フィードバックの記録（doPost, type:'feedback' → シート 'feedback'）
 *   - チャレンジ結果の記録（doPost, type:'result' → シート 'results'）
 *   - 名前ごとのレベル別ベスト（doGet ?name=... → JSON）
 *
 * 使い方（README「フィードバック・結果の受け口」も参照）
 * 1. Google スプレッドシートを新規作成（名前は何でもよい。例「ポジショニングドリル 記録」）
 * 2. メニュー「拡張機能」→「Apps Script」を開き、Code.gs の中身をこのファイルの内容で置きかえて保存
 * 3. 右上「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *      説明: feedback / 次のユーザーとして実行: 自分 / アクセスできるユーザー: 全員
 *    →「デプロイ」。初回は権限の承認が出るので許可する
 * 4. 表示された「ウェブアプリの URL」（https://script.google.com/macros/s/.../exec）を
 *    site.config.mjs の FEEDBACK_ENDPOINT に貼って `npm run build`
 * 5. コードを直したら「デプロイ」→「デプロイを管理」→ 鉛筆 → バージョン「新バージョン」→ デプロイ（URL は変わらない）
 *
 * ---- doPost（サイト側は fetch(url, { method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain'}, body: JSON文字列 })）----
 *   type:'feedback' { type, name, qid, vote:'good'|'bad', comment, level, phase, pos, ua, ts }   → 'feedback' シート
 *   type:'result'   { type, name, level:1|2|3, score, timeSec, rank(ランク名), rankIdx, cleared(目標タイム内なら true),
 *                     qids:[出た10問のID], marks:'◎○×…'(10文字), ts }                            → 'results' シート
 *   type が無いものは feedback として扱う（古いサイトからの送信）。返事: {ok:true} / {ok:false,error}
 *
 * ---- doGet（サイト側は fetch(url + '?name=' + encodeURIComponent(name)) → JSON）----
 *   その name の 'results' からレベル別のベスト（score が最大、同点なら timeSec が短い）を返す:
 *     { "1": { "score": 8.5, "time": 272, "rank": "Jリーグ級", "cleared": true, "ts": "2026-10-18T…" }, "2": {…}, "3": {…} }
 *   記録が無いレベルは入らない。name が空なら {}。名前の一覧や他の人の記録は返さない。
 */
var SHEETS = {
  feedback: { name: 'feedback', header: ['受信日時', 'ts(端末)', 'name', 'qid', 'vote', 'comment', 'level', 'phase', 'pos', 'ua'] },
  result:   { name: 'results',  header: ['受信日時', 'ts(端末)', 'name', 'level', 'score', 'timeSec', 'rank', 'rankIdx', 'cleared', 'qids', 'marks'] },
};

function getSheet_(type) {
  var def = SHEETS[type] || SHEETS.feedback;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(def.name) || ss.insertSheet(def.name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(def.header);
    sh.getRange(1, 1, 1, def.header.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function cleanName_(s) { return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 12); }

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var body = (e && e.postData && e.postData.contents) || '{}';
    var d = JSON.parse(body);
    var type = d.type === 'result' ? 'result' : 'feedback';
    var sh = getSheet_(type);
    if (type === 'result') {
      sh.appendRow([
        new Date(), d.ts || '', cleanName_(d.name), Number(d.level) || '', Number(d.score) || 0, Number(d.timeSec) || 0,
        String(d.rank || '').slice(0, 30), Number(d.rankIdx) || 0, d.cleared ? true : false,
        Array.isArray(d.qids) ? d.qids.join(',') : String(d.qids || ''), String(d.marks || '').slice(0, 20)
      ]);
    } else {
      sh.appendRow([
        new Date(), d.ts || '', cleanName_(d.name), d.qid || '', d.vote || '', String(d.comment || '').slice(0, 200),
        d.level || '', d.phase || '', d.pos || '', String(d.ua || '').slice(0, 300)
      ]);
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// ?name=... → その名前のレベル別ベスト（端末をまたいで最高記録を出すため）
function doGet(e) {
  var name = cleanName_(e && e.parameter && e.parameter.name);
  if (!name) return json_({});
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEETS.result.name);
  if (!sh || sh.getLastRow() < 2) return json_({});
  var header = SHEETS.result.header;
  var col = function (k) { return header.indexOf(k); };
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, header.length).getValues();
  var best = {};
  rows.forEach(function (r) {
    if (cleanName_(r[col('name')]) !== name) return;
    var level = Number(r[col('level')]); if (!level) return;
    var score = Number(r[col('score')]) || 0, time = Number(r[col('timeSec')]) || 0;
    var cur = best[level];
    if (!cur || score > cur.score || (score === cur.score && time < cur.time)) {
      var ts = r[col('ts(端末)')];
      best[level] = { score: score, time: time, rank: String(r[col('rank')] || ''), cleared: r[col('cleared')] === true || r[col('cleared')] === 'TRUE',
        ts: ts instanceof Date ? ts.toISOString() : String(ts || '') };
    }
  });
  return json_(best);
}
