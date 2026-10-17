# ポジショニングドリル（静的サイト版）

小学生向けサッカーの「つぎ、どうする？」問題集（全100問）を、独自ドメインで公開するための静的サイトです。
ビルドすると `dist/` に、問題ごとのページ（`/q/001/` 〜 `/q/100/`）・TOP・カテゴリ一覧・固定ページ・OGP画像・sitemap.xml・robots.txt がすべて生成されます。
問題文・選択肢・ピッチ図（SVG）・解説はすべて HTML に書き出してあるので、Google に本文がそのままインデックスされます。

## 必要なもの

- Node.js 20 以上（https://nodejs.org/ から LTS をインストール）
- それ以外の依存は OGP 画像（PNG）を作るための `@resvg/resvg-js` だけ（`npm install` で入る）

## 使い方

```bash
npm install        # 最初の1回だけ
npm run build      # dist/ を生成（初回は OGP 画像 101 枚を描くので 1〜2 分、2回目以降は数秒）
npm run check      # 全問のページがあり、本文が入っているか確認
npm run serve      # http://localhost:8080/ でローカル確認
```

- `node build.mjs --no-og` … OGP 画像を作らず HTML だけ生成（確認を速く回したいとき）
- OGP 画像は `.og-cache/` にキャッシュされる（Git には入れない）

## 公開前に必ず変えるところ（`site.config.mjs`）

| 項目 | 内容 |
|---|---|
| `SITE_URL` | 公開 URL（例 `https://positioning-drill.com`）。sitemap・canonical・OGP に使う。**仮のままだと検索結果に正しく載らない** |
| `BASE_PATH` | 独自ドメインのルートに置くなら `''`。GitHub Pages のプロジェクトサイト（`https://ユーザー名.github.io/リポジトリ名/`）に置くなら `'/リポジトリ名'` |
| `GA_MEASUREMENT_ID` | Google アナリティクス 4 の測定 ID（`G-XXXXXXXXXX`）。入れると全ページの `<head>` に計測タグが出力される。プレースホルダのままなら出力されない |
| `ADSENSE_CLIENT` | AdSense の審査に通ったらパブリッシャー ID（`ca-pub-…`）を入れる。全ページにサイト用スクリプトが出力される |
| `OWNER_NAME` / `OWNER_DESCRIPTION` / `CONTACT_EMAIL` / `CONTACT_FORM_URL` | 運営者情報・お問い合わせページに表示される |
| `LAST_UPDATED` | sitemap の更新日・プライバシーポリシーの制定日 |

## ディレクトリ構成

```
positioning-drill/
├ build.mjs            ビルドスクリプト（依存なし。ページの HTML はすべてここで組み立てる）
├ check.mjs            ビルド結果の検査
├ serve.mjs            ローカル確認用サーバー
├ site.config.mjs      サイト設定（URL・GA4・AdSense・運営者情報）
├ src/
│ ├ data/              問題データ（唯一の正。元の単一 HTML と同じ省略記法）
│ │ ├ q_helpers.js       Q / O / sc / pl / run / pass / zone … の省略記法
│ │ ├ q_base.js          Q1〜Q5（省略記法を使わず書いた最初の5問）
│ │ └ q_partA.js, q_partB.js, q_partC.js   Q6〜Q100
│ ├ pages/             固定ページ（about / privacy / contact）。{{SITE_NAME}} などは site.config.mjs の値に置き換わる
│ ├ style.css          見た目（元の単一 HTML と同じ）
│ ├ app.js             ブラウザ側の動き（選択 → 答え合わせ → 解説表示、カテゴリのランダム出題、◎○の印）
│ ├ assets/fonts/      OGP 画像の日本語を描くためのフォント（M PLUS Rounded 1c Bold、OFL）
│ └ public/            （任意）ここに置いたファイルは dist/ 直下にそのままコピーされる（ads.txt、Search Console の確認ファイルなど）
├ dist/                ビルド結果（Git には入れない。これをそのまま公開する）
└ .github/workflows/pages.yml   GitHub Pages 用のデプロイ設定
```

### 生成されるページ

| URL | 内容 |
|---|---|
| `/` | TOP。カテゴリ（レベル・場面・セットプレーの種類・ポジション）と全問一覧 |
| `/q/001/` 〜 `/q/100/` | 問題ページ。問題文・ピッチ図・5択・（答え合わせ後に）結果・ポイント・各選択肢の理由と図 |
| `/c/level-1/` など | カテゴリ一覧ページ（`/c/offense/`, `/c/set-play/`, `/c/goal-kick/`, `/c/fw/`, `/c/df-cb/` …） |
| `/about/` `/privacy/` `/contact/` | 運営者情報・プライバシーポリシー・お問い合わせ（AdSense 審査用。子ども向けコンテンツである旨を記載） |
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

`face` / `touch` が無い問題は今まで通り描ける（初級は変更なし）。凡例には中級以上で「体の向き（扇）」、上級で「タッチ（太い矢印＋ボール）」が出る。

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
| `TEAM_PASSCODE` | 合言葉。設定すると初回アクセス時に「合言葉」画面が出て、正しければ端末（localStorage）に記憶して以後は出ない。ブラウザ側だけの簡易ゲートで、本気の認証ではない。大文字小文字・全角半角・空白は区別しない。`''` で無効 |
| `NOINDEX` | `true` なら全ページに `noindex,nofollow` を付け、robots.txt を `Disallow: /` にする（検索に載らない）。一般公開するときは `false` にする |
| `FEEDBACK_ENDPOINT` | 解答ページの 👍👎 の送り先（下記）。空ならボタンは出るが端末の localStorage（`pd-fb`）に貯めるだけ |
| `RANKS` | 10問チャレンジのランク（点数の下限・絵文字・名前・一言）。並びは点数の低い順 |

今は `TEAM_PASSCODE: 'koto'`、`NOINDEX: true` になっている。**一般公開するときは両方外すこと。**

### 10問チャレンジ（レベル別）

TOP の「初級チャレンジ」「中級チャレンジ」「上級チャレンジ」で、そのレベルからランダムに 10 問（重複なし）。画面上部に「3 / 10」と経過タイムが出る。

- 正解点: ◎=1点、○=0.5点、×=0点（10点満点）
- タイム: 問題を見てから「答え合わせ」を押すまでを各問で計り、10問の合計を出す（解説を読んでいる時間は含めない）
- 目標タイム（`CHALLENGE.timeLimit`、秒）: 初級 5:00 / 中級 6:00 / 上級 7:00。合計がこれを超えるとランクが 1 つ下がる（そのレベルの最低ランクより下には下がらない）
- ランク: `RANKS` のはしご（アマチュア級 → 少年団エース級 → 高校選手権級 → Jリーグ級 → 日本代表級 → ワールドカップ級）を、`CHALLENGE.rankTable` でレベルごとに割り当てる。初級の 10 点は Jリーグ級、上級の 10 点はワールドカップ級
- 結果ページ（`/challenge/`）: 合計点・タイム（目標クリア／オーバー）・ランク・各問の◎○×一覧（タップでその問題へ）・「もう一度」「べつのレベルに挑戦」「TOPへ」
- 最高記録はレベルごとに端末（localStorage `pd-best`）に残り、TOP の各ボタンの下に「最高記録: Jリーグ級 7.5点 4:32」と出る
- チャレンジ中は「別の問題」「もう一回」は出ない（最初の答えで採点）。進行は sessionStorage なので、タブを閉じると消える

### 練習モード

TOP の「練習する」でカテゴリ（レベル・場面・セットプレーの種類・ポジション）をえらぶと、その中からランダムに 1 問ずつ出題。「つぎの問題」で同じカテゴリの未出題からランダムに進み、全部出たら最初に戻る。採点やタイムはない。

### 👍👎 フィードバックの受け口（Google Apps Script）

解答ページの「この問題はどうだった？」で 👍/👎 と一言を送る。**👍 か 👎 を押すまで「つぎの問題」「けっかを見る」は押せない**（一言は空でもよい）。送るのは `{ qid, vote, comment, level, phase, pos, ua, ts }`。1問につき1件（送り直しは上書き）。

1. Google スプレッドシートを新規作成（名前は自由）
2. メニュー「拡張機能」→「Apps Script」を開き、Code.gs の中身を [tools/feedback-gas.gs](tools/feedback-gas.gs) で置きかえて保存
3. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」→ 次のユーザーとして実行: **自分**、アクセスできるユーザー: **全員** →「デプロイ」（権限の承認が出たら許可）
4. 表示された「ウェブアプリの URL」（`https://script.google.com/macros/s/…/exec`）を `FEEDBACK_ENDPOINT` に貼って `npm run build`
5. 届いた内容はそのスプレッドシートの `feedback` シートに 1 行ずつ追記される（ヘッダー行は自動で作られる）
6. GAS のコードを直したら「デプロイ」→「デプロイを管理」→ 新バージョンでデプロイ（URL は変わらない）

サイト側は `fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON文字列 })` で送るので、CORS の設定は不要。

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
