# 算数指導書デジタルブック（Fグレード試作版）

講師研修用のPDFを、検索可能な目次と一緒に閲覧するGitHub Pages向け静的Webアプリです。

## 主な機能

- 単元名・キーワード・概要の検索
- 基本単元／プラス単元の絞り込み
- 目次から該当PDFページへ直接移動
- 前後のページ・前後の単元へ移動
- ページ番号指定
- 拡大・縮小・幅に合わせる
- 特定単元をURLで共有
- PC／iPad／スマートフォン対応

## フォルダ構成

```text
sansu-digital-book-prototype/
├─ index.html
├─ styles.css
├─ app.js
├─ data/
│  └─ contents.json
└─ pdf/
   └─ sansu_F.pdf
```

## GitHub Pagesへのアップ手順

### 1. GitHubでリポジトリを作る

1. GitHubへログインします。
2. 右上の「+」から「New repository」を選びます。
3. Repository name に `sansu-digital-book` などを入力します。
4. PDFを公開して問題ない場合は Public を選びます。
5. 「Create repository」を押します。

> GitHub Pagesを通常の無料アカウントで使う場合、基本的に公開リポジトリになります。教材を社外非公開にしたい場合は、公開方法を別途検討してください。

### 2. ファイルをアップロードする

1. 作成したリポジトリで「Add file」→「Upload files」を選びます。
2. このフォルダの中身を、フォルダ構成を保ったままアップロードします。
3. 下部の「Commit changes」を押します。

アップロード後、リポジトリ直下に `index.html` が見えていれば正しい配置です。

### 3. GitHub Pagesを有効にする

1. リポジトリ上部の「Settings」を開きます。
2. 左側の「Pages」を開きます。
3. Build and deployment の Source を「Deploy from a branch」にします。
4. Branch を `main`、フォルダを `/(root)` にします。
5. 「Save」を押します。
6. 数分後、同じ画面に公開URLが表示されます。

公開URLの例：

```text
https://ユーザー名.github.io/sansu-digital-book/
```

## ローカルで確認する方法

`index.html`をダブルクリックして `file://` で開くと、ブラウザのセキュリティ制限によりPDFと目次データを読み込めません。

### Windowsで簡単に確認する

1. ZIPを解凍します。
2. フォルダ内の `start_local.bat` をダブルクリックします。
3. ブラウザで `http://localhost:8000/` が開きます。
4. 終了するときは、黒い画面を閉じます。

### コマンドで起動する

Pythonが入っているPCでは、このフォルダで次を実行します。

```bash
python -m http.server 8000
```

その後、ブラウザで次を開きます。

```text
http://localhost:8000/
```

## C～Eグレードを追加するとき

1. `pdf` フォルダへPDFを追加します。
2. `data/contents.json` に単元データを追加します。
3. 複数PDFを切り替える仕様にする場合は、各データへ `pdf` 項目を追加し、`app.js`を複数冊対応に変更します。

目次データの基本形式：

```json
{
  "id": "f18",
  "code": "F18級",
  "type": "basic",
  "title": "円の面積①",
  "startPage": 3,
  "endPage": 4,
  "keywords": ["円", "面積", "半径", "円周率"],
  "summary": "円の面積を求める単元です。"
}
```

- `startPage`と`endPage`は紙面のノンブルではなくPDF上のページ番号です。
- `type`は通常単元なら`basic`、プラス単元なら`plus`です。
- 検索対象は級・単元名・キーワード・概要です。

## 注意事項

- 現在の試作版は、目次データを対象に検索します。PDF本文全体を横断検索する仕様ではありません。
- PDF本文検索を強化する場合は、各ページの検索用テキストをJSON化して追加できます。
- PDF.jsはMozillaのPDF.jsをCDNから読み込んでいるため、閲覧時にインターネット接続が必要です。

## v5での変更
- iPad版Chrome/Safariで表示されないブラウザ標準PDF埋め込みを廃止しました。
- PDF.jsでPDFページをcanvasに直接描画します。
- サイドメニューの単元選択、ページ送り、拡大・縮小は1回の操作で反映されます。
- 上部のタイトル帯と「この単元のURLをコピー」は削除しています。
