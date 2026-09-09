# Blog — Vite / PHP / SQLite

next-udemy-blogの記事検索・詳細・認証・記事管理と、next-udemy-basicの紹介・お問い合わせを参考に実装。元教材は変更していません。Next.js専用のSSR/SSG/ISR・RSC学習ページは移植対象外です。

## 起動

PHP 8.1以上（pdo_sqlite、mbstring、fileinfo）、Node.js 22.12以上を使用します。
プロジェクトルートでAPIを起動します。

```powershell
php php/serve.php
```

別ターミナルでフロントを起動します。

```powershell
cd front
npm install
npm run dev
```

Viteが表示するURL（通常 http://localhost:5173）を開きます。/apiを127.0.0.1:8020へ転送します。
この環境ではLaragonの実行ファイルを直接指定することもできます。

```powershell
# ルート
& C:/laragon/bin/php/php-8.3.30-Win32-vs16-x64/php.exe php/serve.php
# front内
& C:/laragon/bin/nodejs/node-v22/node.exe node_modules/vite/bin/vite.js
```

## 機能

- 公開記事一覧・検索・詳細
- 新規登録・ログイン・ログアウト・セッション復元
- 自分の記事の作成・編集・削除、公開／下書き
- カバー画像の追加・差し替え・削除（5MB以下のJPEG/PNG/WebP/GIF）
- 紹介・お問い合わせ・完了画面、スマートフォン対応

初期データは空です。登録して記事を作成してください。お問い合わせはSQLiteへの保存のみで、メール送信・問い合わせ管理画面はありません。

## データとAPI

初回アクセスでphp/data/blog.sqliteを自動作成します。画像・セッションもphp/dataに保存します。BLOG_DATA_DIR環境変数で保存先を変更できます。教材のデータは取り込みません。
GET /api/sessionでCSRFトークンを取得し、更新時にX-CSRF-TokenとCookieを送信します。パスワードはハッシュ化、SQLはプレースホルダーを使用。下書きとその画像は作者のみ取得できます。

| メソッド | パス | 機能 |
| --- | --- | --- |
| GET | /api/session | セッション・CSRF |
| POST | /api/register, /api/login, /api/logout | 認証 |
| GET | /api/posts?search= | 公開記事検索 |
| GET | /api/posts?mine=1 | 自分の記事 |
| GET | /api/posts/:id | 詳細 |
| POST | /api/posts | 作成 |
| POST | /api/posts/:id | 更新 |
| DELETE | /api/posts/:id | 削除 |
| GET | /api/media/:filename | 画像 |
| POST | /api/contacts | 問い合わせ保存 |

## 検証・配置

frontでnpm run buildとnpm run lintを実行します。
APIテストはルートでpowershell -ExecutionPolicy Bypass -File php/tests/smoke.ps1を実行します。ポート8027と独立した一時DBを使用します。
本番ではfront/distを配信し、/api/*をphp/index.phpに転送してください。ViteのproxyとPHP内蔵サーバーは開発用です。画面遷移はハッシュURLです。データ保存先は公開ディレクトリ外に設定してください。php/data/.htaccessはApache用のアクセス禁止設定です。
