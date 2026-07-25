# ライフログ 📔

その日の気分・やったこと・メモを記録する、自分専用の日記PWA(Progressive Web App)です。
iPhoneのホーム画面に追加してアプリのように使えます。記録すると、優しく共感してくれる
AIからひとことコメントが届きます。

## 仕組み

```
[ブラウザ / iPhoneホーム画面]
   1. 気分・やったこと・メモを入力して「記録する」
   2. localStorageに記録を保存(サーバー不要、オフラインでも記録可能)
   3. 保存直後、裏側でVercelのAPIへ問い合わせ
        ↓
[Vercel Serverless Function] (api/comment.js)
   4. Claude APIで「優しく共感する友人」トーンの一言コメントを生成
        ↓
[ブラウザ]
   5. 数秒後、記録にAIコメントが自動で追記されて表示される
```

記録データそのものは常にブラウザのlocalStorageのみに保存されます(外部サーバーには送られません)。
AIコメント生成のときだけ、気分・やったこと・メモの内容をVercel経由でClaude APIに送信します。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | 画面のHTML構造 |
| `app.js` | 記録の保存・表示・AIコメント取得・書き出しなど全ロジック |
| `style.css` | 見た目(日記帳風のデザイン) |
| `manifest.json` | PWAの設定(ホーム画面アイコンなど) |
| `sw.js` | オフライン対応のService Worker(静的ファイルをキャッシュ) |
| `api/comment.js` | AIひとことコメントを生成するVercelサーバーレス関数 |
| `vercel.json` / `package.json` | Vercelのデプロイ設定 |

## 使い方

- **記録する**: 日付・気分・やったこと・メモ(任意)を入力して「記録する」。保存直後に一覧に表示され、数秒後にAIコメントが追記される
- **編集・削除**: 履歴の各記録にある✎(編集)・×(削除)ボタンから
- **メモ帳に書き出す**: 画面右上の📤アイコンから。iPhoneでは共有シートが開き「メモ」アプリへ直接渡せる(非対応環境ではクリップボードコピー、それも失敗したらテキストファイルのダウンロードにフォールバック)
- **バックアップ**: 画面下部の「バックアップを書き出す/復元する」でJSON形式の全データを書き出し・読み込みできる(機種変更時などに使用)

## セットアップ手順(再構築する場合)

### 1. GitHub Pages(静的サイト本体)

1. このフォルダをGitHubリポジトリとしてpush
2. `Settings → Pages` で Source を `Deploy from a branch`、Branch を `main` / `(root)` に設定

### 2. Vercel(AIコメント用のAPIプロキシ)

ブラウザから直接Claude APIキーを使うとキーが誰でも見える状態で露出してしまうため、
Vercelのサーバーレス関数を中継させています。

1. Vercel CLIでこのリポジトリを新規プロジェクトとしてリンク(`vercel link`)し、GitHub連携も行う
2. `vercel env add ANTHROPIC_API_KEY production` でClaude APIキーを登録
3. `vercel deploy --prod` でデプロイし、発行された本番URLを `app.js` の `AI_COMMENT_API_URL` に設定
4. `api/comment.js` の `ALLOWED_ORIGIN` を、実際に使うGitHub PagesのURLに合わせて設定(CORS制限用)

## カスタマイズ

- **気分・やったことの選択肢**: `index.html` の `#moodGroup` / `#activityGroup` 内のボタンを編集
- **AIコメントのトーン**: `api/comment.js` の `SYSTEM_PROMPT`
- **AIコメントに使うモデル**: `api/comment.js` の `MODEL`(環境変数 `CLAUDE_MODEL` で上書きも可能)
- **オフラインキャッシュの更新**: `app.js` / `style.css` / `index.html` を変更したら、`sw.js` の `CACHE_NAME` の末尾の番号を上げること(上げないとインストール済みの端末で古い画面がキャッシュされ続けることがある)

## 費用の目安

| 項目 | 費用 |
|---|---|
| GitHub Pages | 無料 |
| Vercel(APIプロキシ) | 無料枠内(呼び出し回数・実行時間ともに少量) |
| Claude API(コメント生成) | 1回あたり1円未満程度(claude-sonnet-5使用、短い応答のため) |
