// ===== サイト設定 =====
// ここを書きかえてから `npm run build` を実行する。
export default {
  // 公開URL（末尾のスラッシュなし）。sitemap.xml / canonical / OGP に使う。独自ドメインを取ったら必ず変える。
  SITE_URL: 'https://koto-inc.github.io',

  // サブディレクトリに置く場合だけ設定（例: GitHub Pages のプロジェクトサイト → '/positioning-drill'）。
  // 独自ドメインのルートに置くなら '' のまま。
  BASE_PATH: '/soccer-drill',

  SITE_NAME: 'ポジショニングドリル',
  TAGLINE: 'サッカーの「つぎ、どうする？」を考える問題集',
  // 小学生が読むので、小学1〜3年の漢字だけで書く（tools/check-kanji.mjs が見る）
  SITE_DESCRIPTION: '小学生向けサッカーのポジショニング問題集。ピッチ図を見て「つぎ、どこへ動く？」を5つの中からえらび、答えと理由を学べる。オフェンス・ディフェンス・セットプレー全105問、むりょう。',
  LANG: 'ja',

  // Google Analytics 4 の測定ID（G-XXXXXXXXXX）。プレースホルダのままなら計測タグは出力されない。
  GA_MEASUREMENT_ID: 'G-XXXXXXXXXX',

  // Google AdSense のパブリッシャーID（ca-pub-XXXXXXXXXXXXXXXX）。プレースホルダのままなら広告タグは出力されない。
  ADSENSE_CLIENT: 'ca-pub-XXXXXXXXXXXXXXXX',

  // 運営者情報・お問い合わせページ・フッターに使う。（固有名詞なので漢字の制限は受けない）
  OWNER_NAME: '松本コーチ', // kanji-ok
  // （保護者向けページ用なので、漢字の制限は受けない）
  OWNER_DESCRIPTION: 'インドネシアの日本人会サッカーチームで、小学生を指導しているコーチです。', // kanji-ok
  CONTACT_EMAIL: 'contact@example.com',
  // Googleフォームなどの問い合わせフォームURL。空ならメールだけを表示。
  CONTACT_FORM_URL: '',

  // 公開した年（プライバシーポリシーの制定日などに使う）
  PUBLISHED_YEAR: 2026,
  LAST_UPDATED: '2026-10-18',

  // ===== チーム内限定公開フェーズ用（一般公開するときは TEAM_PASSCODE を '' に、NOINDEX と HIDE_INFO_PAGES を false にする） =====
  // 合言葉（空なら無効）。小学生が入力するので、ひらがなや数字の短いものに。大文字小文字・全角半角は区別しない。
  TEAM_PASSCODE: 'JJC',
  // true なら全ページに noindex,nofollow を付け、robots.txt でクロールを止める（検索に載らない）
  NOINDEX: true,
  // true なら「コーチについて」「プライバシーポリシー」「お問い合わせ」のページを作らず、フッターのリンクも出さない（チーム内公開のあいだは隠す）
  HIDE_INFO_PAGES: true,

  // 👍👎・チャレンジ結果・答えログの送り先と、なまえごとのベスト記録の取得先（Google Apps Script のウェブアプリURL）。空なら端末の localStorage だけで動く。
  // 受け口の作り方は README と tools/feedback-gas.gs を参照。
  FEEDBACK_ENDPOINT: 'https://script.google.com/macros/s/AKfycbyYlHka9-uUrDGyPQtaQqmG60ZChFy-gy5Wj4a6VZfmoYEuVM_ZxGW18m58dvZDjjU3/exec',
  // 受け口との共通キー。ページから送る内容に付け、tools/feedback-gas.gs の API_KEY と同じ文字列にする（違うと受け口が受け取らない）。
  FEEDBACK_KEY: 'uiJU7xMjpPRvn2oYnakg',

  // ===== レベル別チャレンジ（CHALLENGE.count 問） =====
  // ランクのはしご（下から順）。絵文字は Windows の PC だと国旗（🇯🇵 など）が文字で出てしまうので、国旗以外を使う。
  RANKS: [
    { emoji: '🌱', name: '入門級' },
    { emoji: '⚽', name: '少年サッカー級' },
    { emoji: '🌟', name: '少年サッカーエース級' },
    { emoji: '🏫', name: '高校サッカー級' },
    { emoji: '🏟️', name: 'Jリーグ級' },
    { emoji: '🗾', name: '日本代表級' },
    { emoji: '🏆', name: 'ワールドカップ級' },
  ],
  CHALLENGE: {
    // 1回のチャレンジの問題数。変えたら bands も合わせること。tools/feedback-gas.gs の CHALLENGE_COUNT も同じ値にする
    // （10問時代の記録は、GAS が最初の count 問の◎○×から計算し直す）
    count: 7,
    // 1問の目標タイム（秒）。「問題を見てから答え合わせを押すまで」がこれを超えた問題は timePenalty 点ひかれる（入門・中級・上級とも同じ）
    perQuestionSec: 30,
    timePenalty: 0.5,
    // × の点（マイナス）。◎=1点、○=0.5点
    ngScore: -0.5,
    // 点数の区切り（この点以上で次の段へ）。◎=1点、○=0.5点、×=-0.5点、時間超過は1問 -0.5点、7点満点（合計がマイナスなら 0 点）。ランクは合計点だけで決まる
    bands: [0, 3, 5, 7],             // 0〜2.5 / 3〜4.5 / 5〜6.5 / 7
    // レベルごとに、各段がはしご（RANKS）の何番目か（0=入門級 … 6=ワールドカップ級）
    rankTable: {
      1: [0, 1, 2, 3],   // 入門: 入門級 / 少年サッカー級 / 少年サッカーエース級 / 高校サッカー級
      2: [2, 3, 4, 5],   // 中級: 少年サッカーエース級 / 高校サッカー級 / Jリーグ級 / 日本代表級
      3: [3, 4, 5, 6],   // 上級: 高校サッカー級 / Jリーグ級 / 日本代表級 / ワールドカップ級
    },
    // 結果ページの一言。{next} は1つ上のランク名に置きかわる。最上位のときは top を使う
    msg: 'つぎは{next}をねらおう！',
    msgTop: 'パーフェクト！きみは世界一のポジショニング！',
  },
};
