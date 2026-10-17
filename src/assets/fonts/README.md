# フォント（OGP画像の生成にだけ使う）

- `MPLUSRounded1c-Bold.ttf` — M PLUS Rounded 1c Bold（The M+ FONTS Project Authors）
  - ライセンス: SIL Open Font License 1.1（`OFL.txt`）
  - 入手元: https://github.com/google/fonts/tree/main/ofl/mplusrounded1c
- サイト本体は Google Fonts から読み込むので、このファイルは dist/ には含まれない。
- `build.mjs` が OGP 画像（dist/og/*.png）を作るときに、日本語の文字を描くために読み込む。
