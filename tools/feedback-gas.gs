/**
 * ポジショニングドリル 👍👎 フィードバックの受け口（Google Apps Script）
 *
 * 使い方（README「フィードバックの受け口」も参照）
 * 1. Google スプレッドシートを新規作成（名前は何でもよい。例「ポジショニングドリル フィードバック」）
 * 2. メニュー「拡張機能」→「Apps Script」を開き、Code.gs の中身をこのファイルの内容で置きかえて保存
 * 3. 右上「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *      説明: feedback / 次のユーザーとして実行: 自分 / アクセスできるユーザー: 全員
 *    →「デプロイ」。初回は権限の承認が出るので許可する
 * 4. 表示された「ウェブアプリの URL」（https://script.google.com/macros/s/.../exec）を
 *    site.config.mjs の FEEDBACK_ENDPOINT に貼って `npm run build`
 * 5. コードを直したら「デプロイ」→「デプロイを管理」→ 鉛筆 → バージョン「新バージョン」→ デプロイ（URL は変わらない）
 *
 * サイト側は fetch(url, { method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain'}, body: JSON文字列 }) で送る。
 * 送られてくる JSON: { qid, vote:'good'|'bad', comment, level, phase, pos, ua, ts }
 */
var SHEET_NAME = 'feedback';
var HEADER = ['受信日時', 'ts(端末)', 'qid', 'vote', 'comment', 'level', 'phase', 'pos', 'ua'];

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADER);
    sh.getRange(1, 1, 1, HEADER.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var body = (e && e.postData && e.postData.contents) || '{}';
    var d = JSON.parse(body);
    var sh = getSheet_();
    sh.appendRow([
      new Date(), d.ts || '', d.qid || '', d.vote || '', String(d.comment || '').slice(0, 200),
      d.level || '', d.phase || '', d.pos || '', String(d.ua || '').slice(0, 300)
    ]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// ブラウザで URL を開いたときの動作確認用
function doGet() {
  return ContentService.createTextOutput('positioning-drill feedback endpoint OK');
}
