# ポジショニングドリル（静的サイト版）

小学生向けサッカーの「つぎ、どうする？」問題集（全105問）を、独自ドメインで公開するための静的サイトです。
ビルドすると `dist/` に、問題ごとのページ（`/q/001/` 〜 `/q/105/`）・TOP・カテゴリ一覧・固定ページ・OGP画像・sitemap.xml・robots.txt がすべて生成されます。
問題文・選択肢・ピッチ図（SVG）・解説はすべて HTML に書き出してあるので、Google に本文がそのままインデックスされます。

## 必要なもの

- Node.js 20 以上（https://nodejs.org/ から LTS をインストール）
- それ以外の依存は OGP 画像（PNG）を作るための `@resvg/resvg-js` だけ（`npm install` で入る）

## 使い方

```bash
npm install        # 最初の1回だけ
npm run build      # dist/ を生成（初回は OGP 画像 101 枚を描くので 1〜2 分、2回目以降は数秒）
npm run check      # 全問のページがあり本文が入っているか ＋ 漢字が小1〜3配当表だけか ＋ 用語辞書の漏れがないか
npm run serve      # http://localhost:8080/ でローカル確認
```

- `node build.mjs --no-og` … OGP 画像を作らず HTML だけ生成（確認を速く回したいとき）
- OGP 画像は `.og-cache/` にキャッシュされる（Git には入れない）

## 文章のルール（小学3年生が読める形）

子どもが見る文章（問題データ・UI の文言・用語の説明）は **小学1〜3年の配当漢字（1年80字・2年160字・3年200字）だけ** を使う。それ以外の漢字はひらがなにする（例: 選手→せんしゅ、裏→うら、守備→しゅび、攻撃→こうげき、距離→きょり、正解→せいかい、位置→場所）。FW/MF/DF/GK/SB/CB などの記号はそのまま。

```bash
npm run check:kanji          # 配当表外の漢字を「ファイル:行 漢字 …前後の文脈…」で列挙（1件でもあれば exit 1）。npm run check にも含まれる
node tools/check-kanji.mjs --summary   # さらに漢字ごとの件数
npm run list-terms           # 問題データのカタカナ語のうち、用語辞書（src/data/terms.js）に無いものを列挙
node tools/list-terms.mjs --all        # 全部の語と件数（辞書にあるものは ✓）
node tools/kanji-to-kana.mjs # 辞書（tools/kanji-to-kana.mjs の DICT）で問題データの漢字を一括でひらがなに置き換える。置換後は必ず目で確認
```

- 配当表は `tools/kanji-grade123.txt`。検査対象は `src/data/*.js`・`build.mjs`・`src/app.js`・`site.config.mjs` の **文字列リテラルの中** だけ（コメントは見ない）。`src/pages/`（運営者情報・プライバシーポリシー・お問い合わせ）は保護者向けなので対象外
- 保護者向け・開発者向けの文字列（console の警告、AdSense のコメント、`OWNER_DESCRIPTION` など）は行末に `// kanji-ok` を付けると検査から外れる
- レベル名は「入門／中級／上級」（「初級」の「初」が4年の漢字のため）。ランク名も小3の漢字で読めるもの（入門級・少年サッカー級など）にしてある

## サッカー用語の「ことば」ボックス

- 辞書は `src/data/terms.js`（`t` 表記 / `alt` 表記ゆれ / `d` 小3向けの1文の説明 / `hide` は一覧ページだけに出す）。説明文も漢字ルールの対象
- 問題ページでは、その問題（title・q・選択肢・why・point・図のラベル）に出てくる用語だけを、問題文の下（選択肢の上）の「ことば」ボックスに並べる。本文中の用語には画面ごとの初出に点線の下線が付き、タップすると同じ説明が小さく出る（選択肢ボタンの中には付けない）
- `/words/` に全用語の一覧ページ（TOP のフッターからリンク）。noindex などは他のページと同じ扱い
- 辞書に無いカタカナ語は `npm run check` が NG にする → `terms.js` に追加するか、ふだんの言葉なら `tools/list-terms.mjs` の `IGNORE` に入れる

## 公開前に必ず変えるところ（`site.config.mjs`）

| 項目 | 内容 |
|---|---|
| `SITE_URL` | 公開 URL（例 `https://positioning-drill.com`）。sitemap・canonical・OGP に使う。**仮のままだと検索結果に正しく載らない** |
| `BASE_PATH` | 独自ドメインのルートに置くなら `''`。GitHub Pages のプロジェクトサイト（`https://ユーザー名.github.io/リポジトリ名/`）に置くなら `'/リポジトリ名'` |
| `GA_MEASUREMENT_ID` | Google アナリティクス 4 の測定 ID（`G-XXXXXXXXXX`）。入れると全ページの `<head>` に計測タグが出力される。プレースホルダのままなら出力されない |
| `ADSENSE_CLIENT` | AdSense の審査に通ったらパブリッシャー ID（`ca-pub-…`）を入れる。全ページにサイト用スクリプトが出力される |
| `OWNER_NAME` / `OWNER_DESCRIPTION` / `CONTACT_EMAIL` / `CONTACT_FORM_URL` | 運営者情報・お問い合わせページと、フッターの「作った人」・author メタに表示される（今は「松本コーチ」） |
| `LAST_UPDATED` | sitemap の更新日・プライバシーポリシーの制定日 |

## ディレクトリ構成

```
positioning-drill/
├ build.mjs            ビルドスクリプト（依存なし。ページの HTML はすべてここで組み立てる）
├ check.mjs            ビルド結果の検査（＋漢字・用語辞書の検査）
├ tools/
│ ├ kanji-grade123.txt   小学1〜3年の配当漢字表
│ ├ check-kanji.mjs      配当表外の漢字を列挙
│ ├ kanji-to-kana.mjs    漢字→ひらがなの一括置換（辞書つき）
│ └ list-terms.mjs       用語辞書に無いカタカナ語を列挙
├ serve.mjs            ローカル確認用サーバー
├ site.config.mjs      サイト設定（URL・GA4・AdSense・運営者情報）
├ src/
│ ├ data/              問題データ（唯一の正。元の単一 HTML と同じ省略記法）
│ │ ├ q_helpers.js       Q / O / sc / pl / run / pass / zone … の省略記法
│ │ ├ terms.js           サッカー用語の辞書（「ことば」ボックス・/words/ の元）
│ │ ├ q_base.js          Q1〜Q5（省略記法を使わず書いた最初の5問）
│ │ └ q_partA.js, q_partB.js, q_partC.js   Q6〜Q105（Q101〜105 は「しゅびの5つのきほん」）
│ ├ pages/             固定ページ（about / privacy / contact）。{{SITE_NAME}} などは site.config.mjs の値に置き換わる
│ ├ style.css          見た目（元の単一 HTML と同じ）
│ ├ app.js             ブラウザ側の動き（合言葉＋なまえのゲート、選択 → 答え合わせ → 解説表示、👍👎、練習モード、レベル別チャレンジ、用語のタップ、スプレッドシートへの送信・取得）
│ ├ assets/fonts/      OGP 画像の日本語を描くためのフォント（M PLUS Rounded 1c Bold、OFL）
│ └ public/            （任意）ここに置いたファイルは dist/ 直下にそのままコピーされる（ads.txt、Search Console の確認ファイルなど）
├ dist/                ビルド結果（Git には入れない。これをそのまま公開する）
└ .github/workflows/pages.yml   GitHub Pages 用のデプロイ設定
```

### 生成されるページ

| URL | 内容 |
|---|---|
| `/` | TOP。カテゴリ（レベル・場面・セットプレーの種類・ポジション）と全問一覧 |
| `/q/001/` 〜 `/q/105/` | 問題ページ。問題文・ピッチ図・5択・（答え合わせ後に）結果・ポイント・各選択肢の理由と図 |
| `/c/level-1/` など | カテゴリ一覧ページ（`/c/offense/`, `/c/set-play/`, `/c/goal-kick/`, `/c/fw/`, `/c/df-cb/` …） |
| `/about/` `/privacy/` `/contact/` | 運営者情報・プライバシーポリシー・お問い合わせ（AdSense 審査用。子ども向けコンテンツである旨を記載）。`HIDE_INFO_PAGES: true` のあいだは作らない |
| `/words/` | サッカーのことば（用語 79 語の一覧） |
| `/challenge/` | レベル別チャレンジ（7問）のレベル選択・結果ページ（中身は app.js が描く） |
| `/og/q-001.png` … `/og/default.png` | OGP 画像（1200×630、ピッチ図＋タイトル） |
| `/sitemap.xml` `/robots.txt` `/404.html` `/favicon.svg` | |

## 問題を増やす・直す

`src/data/q_partC.js` などに、既存と同じ書き方で `Q(...)` を追加して `npm run build` するだけです。番号（Q1〜）は並び順から自動で付きます。
`run()` などの矢印は座標を平たく並べて書く（`run(34,24,38,7)` = (34,24)→(38,7)）。

### 体の向きとファーストタッチ（中級・上級）

| 書き方 | 意味 |
|---|---|
| `pl('me',34,36,'MF',face(34,10))` | 選手に体の向きを持たせる。`face(x,y)` は「向いている先」の座標。問題図では白い扇（視野）で描かれる |
| `options[].a` の中に `face:[x,y]` | 解答図で「きみ」の正しい向きを黄色の扇で描く（`movers` で動かしたあとの位置に描く） |
| `touch(x1,y1,x2,y2)` | ファーストタッチの方向。短く太い白の矢印で、先にボールを描く。`arrows:[...]` の中に書く。足（相手から遠い足など）は選択肢の文章で表す |

`face` / `touch` が無い問題は今まで通り描ける（入門は変更なし）。凡例には中級以上で「体の向き（おうぎ）」、上級で「タッチ（太いやじるし＋ボール）」が出る。

## デプロイ

### Cloudflare Pages（おすすめ：独自ドメイン・無料・速い）

1. このフォルダを GitHub のリポジトリに push する（`dist/` と `node_modules/` は `.gitignore` 済み）
2. Cloudflare ダッシュボード → Workers & Pages → Create → Pages → Connect to Git → リポジトリを選ぶ
3. ビルド設定
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - 環境変数: `NODE_VERSION` = `20`
4. Deploy。`https://xxx.pages.dev` で公開される
5. 独自ドメイン: Pages のプロジェクト → Custom domains → ドメインを追加（Cloudflare で DNS を管理していれば自動設定）
6. `site.config.mjs` の `SITE_URL` を独自ドメインに変えて push し直す

### GitHub Pages

1. GitHub にリポジトリを作って push（`main` ブランチ）
2. リポジトリの Settings → Pages → Build and deployment → Source を **GitHub Actions** にする
3. push するたびに `.github/workflows/pages.yml` がビルドして公開する
4. 独自ドメイン: Settings → Pages → Custom domain にドメインを入れ、DNS に CNAME（`ユーザー名.github.io`）を設定。`site.config.mjs` の `SITE_URL` も合わせる
   - プロジェクトサイト（`https://ユーザー名.github.io/リポジトリ名/`）のままで使うなら `BASE_PATH: '/リポジトリ名'` にする

## チーム内限定公開フェーズの機能（`site.config.mjs`）

| 項目 | 内容 |
|---|---|
| `TEAM_PASSCODE` | 合言葉。設定すると初回アクセス時に「合言葉＋なまえ」画面が出て、正しければ端末（localStorage）に記憶して以後は出ない。ブラウザ側だけの簡易ゲートで、本気の認証ではない。大文字小文字・全角半角・空白は区別しない。`''` にすると合言葉は聞かず、なまえだけ聞く |
| `NOINDEX` | `true` なら全ページに `noindex,nofollow` を付け、robots.txt を `Disallow: /` にする（検索に載らない）。一般公開するときは `false` にする |
| `HIDE_INFO_PAGES` | `true` なら「コーチについて」「プライバシーポリシー」「お問い合わせ」の 3 ページを作らず、フッターのリンクも出さない（チーム内公開のあいだ用）。一般公開・AdSense 審査のときは `false` にする |
| `FEEDBACK_ENDPOINT` | 👍👎・チャレンジ結果・1問ごとの答えログの送り先と、端末をまたいだベスト記録の取得先（下記）。空なら端末の localStorage だけで動く |
| `FEEDBACK_KEY` | 受け口との共通キー。送信・取得のたびに付け、`tools/feedback-gas.gs` の `API_KEY` と同じ文字列にする（違うと受け口が `forbidden` を返す）。受け口は先頭が `= + - @` の文字列に空白を足して書くので、数式として実行されない |
| `RANKS` | レベル別チャレンジのランク（点数の下限・絵文字・名前・一言）。並びは点数の低い順 |

今は `TEAM_PASSCODE: 'JJC'`、`NOINDEX: true`、`HIDE_INFO_PAGES: true` になっている。**一般公開するときは 3 つとも外すこと。**

### レベル別チャレンジ（7問）

TOP の「入門チャレンジ」「中級チャレンジ」「上級チャレンジ」で、そのレベルからランダムに 7 問（`CHALLENGE.count`。1回の中で同じ問題は出ない。同じなまえでは前のチャレンジで出た問題をなるべく出さず、そのレベルを出し切ったら最初から）。画面上部に「3 / 7」と経過タイムが出る。

- 正解点: ◎=1点、○=0.5点、×=0点（7点満点）。点数の区切りは `CHALLENGE.bands`（0〜2.5 / 3〜4.5 / 5〜6.5 / 7）
- タイム: 問題を見てから「答え合わせ」を押すまでを各問で計り、7問の合計を出す（解説を読んでいる時間は含めない）
- 採点: 1問の点 ＝ 正解のぶん（全部=1点 ◎、一部=0.5点 ○、なし=0点 ×）− `CHALLENGE.missPenalty`（0.5点）× まちがいを選んだ数。1問の下限は 0 点。5つ全部チェックしても得にならない（正解2つなら 1−1.5 → 0点）。1問の目標タイムは `CHALLENGE.perQuestionSec`（30秒、レベル共通）で、「問題を見てから答え合わせを押すまで」がこれを超えた問題は `CHALLENGE.timePenalty`（0.5点）ひかれる。ランクは合計点だけで決まる（タイムは点に含まれる）
- ランク: `RANKS` のはしご（入門級 → 少年サッカー級 → 少年サッカーエース級 → 高校サッカー級 → Jリーグ級 → 日本代表級 → ワールドカップ級）を、`CHALLENGE.rankTable` でレベルごとに割り当てる。入門は 入門級/少年サッカー級/少年サッカーエース級/高校サッカー級、中級は 少年サッカーエース級〜日本代表級、上級は 高校サッカー級〜ワールドカップ級（0〜2.5 / 3〜4.5 / 5〜6.5 / 7 点の順）
- 結果ページ（`/challenge/`）: 合計点・タイム（30秒をこえた問題の数）・ランク・各問の◎○×一覧（タップでその問題へ）・「🏆 ランキングにとうろくする」（`FEEDBACK_ENDPOINT` があるとき）・「もう一度」「べつのレベルをやる」「TOPへ」
- TOP のチャレンジ枠には「級のはしご」（`RANKS` を順に並べたもの）と「入門で7点なら 高校サッカー級、上級で7点なら…ワールドカップ級！」のあおり文が出る
- ベスト記録はなまえ×レベルごとに端末（localStorage `pd:<name>:best`）に残り、TOP と /challenge/ の各ボタンの下に「〇〇さんのベストきろく: 🏟️ Jリーグ級 7.5点 4:32」と出る（スプレッドシートに大きい記録があればそれに差し替わる）。結果ページにも「🎉 〇〇さんの入門のベストきろく！」と出る
- チャレンジ中は「べつの問題」「もう一回」は出ない（最初の答えで採点）。進行は sessionStorage なので、タブを閉じると消える

### 練習モード

TOP の「練習する」でカテゴリ（レベル・場面・セットプレーの種類・ポジション）をえらぶと、その中からランダムに 1 問ずつ出題。「つぎの問題」で同じカテゴリの未出題からランダムに進み、全部出たら最初に戻る。採点やタイムはない。

### ランキング（レベル別）

問題数を 10 問から 7 問に変えたので、10 問時代の記録（`results` の `marks` が 10 文字の行、`ranking` の 7 点をこえる行）は GAS が「最初の 7 問の◎○×」で点を計算し直し、タイムは 7/10 に縮めて返す（`tools/feedback-gas.gs` の `adjust_`）。シートの元の行は書きかえない。端末内の 10 問時代のベストは捨てて、GAS から取り直す。

結果ページで「🏆 ランキングにとうろくする」を押した記録だけが、TOP の「ランキング」（レベルごとにトップ 10 人）に出る。押さなければ出ない（オプトイン）。同じなまえは、とうろくした中のベスト（点が高い、同点ならタイムが短い）1 件だけ。TOP を開くと GAS の `?ranking=1` を取りに行き、取れないときは前回の結果（localStorage `pd-ranking`）を出す。自分のなまえの行は色がつく。`FEEDBACK_ENDPOINT` が空ならランキング枠もボタンも出ない。

とうろくは端末からの申告なので、本気の不正対策はない（チーム内向け）。変な行はスプレッドシートの `ranking` シートから消せば消える（60 秒以内に反映）。

### なまえごとの記録

ゲートで「なまえ（ニックネームで OK、1〜12 文字）」も入れる。同じ端末を何人かで使う前提で、記録（レベル別ベスト・◎○の印・👍👎 の送信済み印）はなまえごとに分かれる。TOP と /challenge/ に「〇〇さんのきろく」と「べつの人にかわる」ボタンが出て、押すとなまえだけ入れ直す（合言葉は聞かない）。入力欄の下には、その端末で過去に使ったなまえ（最大 5 件）が出てタップで選べる。サイト上になまえの一覧は出さない。

localStorage のキー:

| キー | 内容 |
|---|---|
| `pd-pass` | 合言葉（合っていればその値） |
| `pd-name` | いま使っているなまえ |
| `pd-names` | この端末で使ったなまえの候補（新しい順、最大 5 件） |
| `pd:<name>:best` | レベル別ベスト `{ level: { score, time, rank, ts } }` |
| `pd:<name>:solved` | 解いた印 `{ qid: 'ok' | 'tried' }` |
| `pd:<name>:fb` | 👍👎 の送信済み `{ qid: payload }` |
| `pd:<name>:tries` | 答え合わせをした回数 `{ qid: n }`（答えログの `attempt`） |
| `pd-ranking` | 最後に取れたランキング `{ ts, data }`（取れないときの表示用） |

なまえ導入前の `pd-best` / `pd-solved` / `pd-fb` は、その端末で最初に登録したなまえに引きつぐ（それ以外では読まない）。

### 👍👎・チャレンジ結果の受け口（Google Apps Script）

解答ページの「かいせつは、わかりやすかった？」で 👍（わかりやすい）/👎（わかりにくい）と一言を送る（解説のわかりやすさを聞く。むずかしさではない）。**👍 か 👎 を押すまで「つぎの問題」「けっかを見る」は押せない**（一言は空でもよい）。👎 を押したときだけ、一言欄の上に**理由チップ**（「ことばがわからない」「図のどこか分からない」「答えがちがうと思う」「かんたんすぎ」「ほかの理由（ひとことに書く）」。タップで複数選べる。選ばなくても進める）が出る。送信は 2 秒待ってまとめて行い、チップや一言を足すと同じ内容を送り直す（ページを出るときは待たずに送る）。端末内では 1問につき1件（送り直しは上書き）だが、シートには同じ `name`+`qid` の行が複数できることがあるので**いちばん下の行が最新**。チャレンジを終えると結果も同じ受け口に送る。答え合わせを押すたびに、1問ごとの**答えログ**（何を選んだか・正解か・かかった秒数・何回目か）も送る（練習でもチャレンジでも）。受け口は `?name=…` の GET で、そのなまえのレベル別ベストも返す（端末をまたいで最高記録を出すため。TOP を開いたときに取りに行き、端末内の記録と比べて大きいほうを表示・保存する。失敗しても端末内の記録で表示する）。

送る JSON（POST、`type` で区別）:

- `type:'feedback'` … `{ type, name, qid, vote:'good'|'bad', comment, reasons:['ことばがわからない', …], level, phase, pos, device（'スマホ'｜'タブレット'｜'PC'。シートでは ua 列に入る）, ts }` → **feedback** シート
- 👎 のときは **badlist** シートにも1行（最終更新・name・qid・問題ページのURL・level/phase/pos・reasons・comment・ua）。同じ name+qid の送り直しは行を更新。あとで 👍 に変わっても消さない。過去の feedback から作り直すときは Apps Script エディタで `rebuildBadlist` を実行（何度でも可。badlist に手で書いたメモは消える）（一度でも 👎 が押された name+qid を、いちばん下の 👎 の内容で並べる）
- `type:'result'` … `{ type, name, level, score, timeSec, rank, rankIdx, cleared, qids:[…], marks:'◎○×…', ts }` → **results** シート
- `type:'answer'` … `{ type, name, qid, level, phase, pos, picked:[押した選択肢の添字 0〜4], correct:[正解の添字], result:'ok'|'partial'|'ng', timeSec, attempt, mode:'challenge'|'practice', ts }` → **answers** シート
- `type:'rank'` … `{ type, name, level, score, timeSec, rank, rankIdx, ts }`（「ランキングにとうろく」を押したとき） → **ranking** シート

返る JSON（GET `?name=…`）: `{ "1": { score, time, rank, cleared, ts }, "2": {…}, "3": {…} }`（記録が無いレベルは入らない。name が空なら `{}`。答えログ・フィードバックは GET では返さない）

返る JSON（GET `?ranking=1`）: `{ "1": [ { name, score, time, rank, rankIdx }, … ], "2": […], "3": […] }`（とうろくした人のベストを、レベルごとに点が高い順・同点ならタイムが短い順にトップ 10 人。60 秒キャッシュ、とうろくがあると消える）

スプレッドシートは **feedback** / **results** / **answers** / **ranking** の 4 シート（ヘッダー行は自動で作られる。列が増えたときは足りないヘッダーだけ末尾に書き足され、既存の列は動かない）。結果を見るときは results シートを `name` 列でフィルタすると、その子のチャレンジ履歴（レベル・点・タイム・ランク・出た問題・◎○×の列）が時系列で並ぶ。

#### answers シートの列と、問題を直すときの見方

| 列 | 中身 |
|---|---|
| `受信日時` / `ts(端末)` | GAS が受け取った時刻 / 端末の時刻（ISO） |
| `name` / `qid` / `level` / `phase` / `pos` | なまえ、問題番号、レベル（1〜3）、オフェンスなど、ポジション |
| `picked` | 押した選択肢の添字（0=ア … 4=オ）。複数なら `0,2` のようにカンマ区切り（押した順） |
| `correct` | 正解の添字（同じ形式） |
| `result` | `ok`（◎ 全部あてた）/ `partial`（○ 一部）/ `ng`（×） |
| `timeSec` | 問題を表示してから答え合わせを押すまでの秒数（小数1桁）。「もう一回」で戻ったときは戻ってからの秒数 |
| `attempt` | その子がその問題に答えた回数（1 = はじめて。「もう一回」や別の日のやり直しで 2, 3, …） |
| `mode` | `challenge`（チャレンジ中）/ `practice`（練習） |

集計はピボットテーブル（「挿入」→「ピボットテーブル」、データ範囲は answers シート全体）で、行に `qid` を置いて次を見る。はじめて解いたときの出来を見たいなら `attempt` = 1 でフィルタする。

- **正答率** … 値に `result`（COUNTA）、列に `result` を置くと、`qid` ごとの ok / partial / ng の数が並ぶ。ok ÷ 合計が正答率。関数なら `=COUNTIFS(answers!D:D, 12, answers!J:J, "ok") / COUNTIF(answers!D:D, 12)`（Q12 の例。D 列 = qid、J 列 = result）
- **いちばん選ばれたまちがいの選択肢** … `result` が `ng` / `partial` の行だけにして、行に `qid`、列に `picked`、値に COUNTA。数が多い `picked` が「子どもがひっかかる選択肢」。その選択肢の `why`（解説）か、問題文・図を見直す
- **平均 timeSec** … 値に `timeSec`（AVERAGE）。長い問題は、図が読みにくいか、問題文が長い・むずかしい
- **直す順番** … 正答率が低く（目安 50% 未満）、かつ feedback シートで同じ `qid` の 👎（`vote` = bad）が多い問題から直す。feedback の `reasons` 列（カンマ区切り）で「ことばがわからない」が多ければ用語辞書（`src/data/terms.js`）か問題文、「図のどこか分からない」が多ければ図（`src/data` の座標）、「答えがちがうと思う」が多ければ正解と解説を見直す。「かんたんすぎ」が多ければレベルを上げるか選択肢をむずかしくする

正答率は高いのに 👎 が多い問題は「解けるけど解説がわかりにくい」問題。逆に 👍 が多いのに正答率が低い問題は「解説を読んで納得はしている」ので、問題文や図の見せ方を直す。

1. 保存先のスプレッドシートを開く（`tools/feedback-gas.gs` の `SPREADSHEET_ID` に ID が入っている。別のシートにするときは、その ID を書きかえる）
2. メニュー「拡張機能」→「Apps Script」を開き、Code.gs の中身を [tools/feedback-gas.gs](tools/feedback-gas.gs) で置きかえて保存
3. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」→ 次のユーザーとして実行: **自分**、アクセスできるユーザー: **全員** →「デプロイ」（権限の承認が出たら許可）
4. 表示された「ウェブアプリの URL」（`https://script.google.com/macros/s/…/exec`）を `FEEDBACK_ENDPOINT` に貼って `npm run build`
5. 届いた内容はそのスプレッドシートの `feedback` / `results` / `answers` / `ranking` シートに 1 行ずつ追記される（ヘッダー行は自動で作られる）
6. GAS のコードを直したら「デプロイ」→「デプロイを管理」→ 新バージョンでデプロイ（URL は変わらない）

サイト側は `navigator.sendBeacon(url, Blob(JSON文字列, text/plain))`（使えなければ `fetch(url, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain' }, body: JSON文字列 })`）で送るので、CORS の設定は不要で、👍 の直後にページを移っても送信は消えない。ベスト記録の取得は通常の `fetch(url + '?name=…')` → `JSON.parse`（GAS のリダイレクトはそのまま follow）。

## 公開後にやること

1. **Google Search Console** にサイトを登録し、`https://ドメイン/sitemap.xml` を送信する（所有権確認用の HTML ファイルは `src/public/` に置けば dist/ 直下に出る）
2. **Google アナリティクス 4** でプロパティを作り、測定 ID を `GA_MEASUREMENT_ID` に入れて再ビルド
3. **AdSense** に申請。審査に通ったら
   - `ADSENSE_CLIENT` にパブリッシャー ID を入れる
   - AdSense が発行する `ads.txt` を `src/public/ads.txt` に置く
   - 広告ユニットのコードを、各ページの `<!-- AD SLOT: ... -->` コメントの位置（`build.mjs` の `adSlot()`）に貼る。枠は 3 か所
     - `answer-bottom` … 問題ページで答え合わせをしたあと、解説の下・「つぎの問題」ボタンの上
     - `home-bottom` … TOP の問題一覧の下
     - `list-bottom` … カテゴリ一覧ページの下
   - 子ども向けサイトなので、広告ユニットには `data-tag-for-child-directed-treatment="1"` を付け、AdSense の設定でもパーソナライズ広告を無効にする（AdSense ヘルプ「子ども向けとして広告リクエストにタグを付ける」を参照）
4. `OWNER_NAME` などの運営者情報を本物に書きかえる（AdSense 審査では運営者情報・プライバシーポリシー・お問い合わせの 3 ページが見られる）

## 元の単一 HTML との関係

元の `positioning-drill.html`（claude.ai の Artifact）と見た目・問題文・操作（選ぶ → 答え合わせ → ◎○× と解説）は同じです。違いは

- 1 問 1 ページ（URL）になった。「つぎの問題」は TOP でえらんだカテゴリの順（セッション内で保持）、えらんでいなければ番号順
- 答えと解説は最初から HTML に入っていて（非表示）、答え合わせで表示される。JavaScript が切れていても問題文と図は読める
- 「解いた印（◎○）」は同じく localStorage に保存される
