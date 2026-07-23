# 算数指導書デジタルブック（安定版）

外部CDNのPDF.jsを使わず、ブラウザ標準のPDF表示機能を利用する版です。

## 更新手順
GitHubのリポジトリで、次のファイルを上書きしてください。
- index.html
- app.js
- styles.css

`data/contents.json` と `pdf/sansu_F.pdf` は、そのままで構いません。

反映後は次のURLを開き、Ctrl+F5で強制再読み込みしてください。
https://mypace-manabi.github.io/sansu-digital-book/

## 直接確認用URL
- PDF: `https://mypace-manabi.github.io/sansu-digital-book/pdf/sansu_F.pdf`
- 目次JSON: `https://mypace-manabi.github.io/sansu-digital-book/data/contents.json`

## 2026-07 更新
- 画面上部のタイトル帯と「この単元のURLをコピー」を削除しました。
- 単元選択時に、Chrome/Edge内蔵PDFビューアーを強制再読み込みして、該当ページへ確実に移動するよう修正しました。
