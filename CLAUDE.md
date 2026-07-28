# CLAUDE.md

このファイルは、このリポジトリで作業する Claude Code (claude.ai/code) にガイダンスを提供します。

## 会話言語

このリポジトリで作業する際は、ユーザーとの会話は日本語で行うこと。

## これは何か

`auto-oauth2` は、CLI・ローカルツール向けに OAuth2 認可コードフローを自動化する小さな npm ライブラリ
（`auto-oauth2` として公開）です。認可 URL を開き、リダイレクトを受け取るための一時的なローカル HTTP
サーバーを起動し（あるいはユーザーにコードを手動で貼り付けるよう促し）、コードをアクセストークンに交換し、
トークンをローカルの JSON ファイルにキャッシュします（期限切れ時は `refresh_token` で更新）。

## コマンド

- `npm run build` — TypeScript（`lib/**/*` + `index.ts`）を `tsc` で `dist/` にコンパイルする。
- `npm run dev` — `tsc --watch`。
- `npm test` — Jest のテストスイートを実行する。
- 単一のテストファイルを実行: `npx jest lib/__tests__/test-auto-oauth2.ts`
- 名前にマッチするテストを実行: `npx jest -t "loadAccessToken"`
- `npm run dry-run-publish` — `dist/` をクリーンにしてビルドし、`npm pack` が公開するであろう tar ball の中身を確認する（実際には公開しない）。

`package.json` に独立した lint スクリプトはないが、`tslint.json`（`tslint-plugin-prettier` を extends）と
`.prettierrc` がスタイルを定義している: セミコロンなし、シングルクォート、幅120文字。`npm run lint` が
存在しないため、編集時はこのスタイル（2スペースインデント、セミコロンなし、シングルクォート）に手動で
合わせること。

## アーキテクチャ

公開 API は `index.ts` から re-export されている。`index.ts` は単に `export * from './lib/auto-oauth2'` と
`export * from './lib/cli-parser'` を行うだけである。実際の処理は `lib/` 配下の3ファイルが担う:

- **`lib/auto-oauth2.ts`** — メインのエントリポイントである `AutoOauth2` クラス。`autoAuthorize()` が
  フロー全体を担う:
  1. `loadAccessToken()` — `.accesstoken.json`（または `tokenSavePath`）を読み込む。トークンが期限切れで
     なければ（`created_at + expires_in*1000 > now`）そのまま返す。期限切れでも `refresh_token` があれば
     黙ってリフレッシュする。それ以外はフォールスルーする。
  2. `requestAuthorizeCode()` — `authorizeUri` + クライアントID・スコープ・`vendorOptions` から認可 URL を
     組み立て、`redirectUri` のポートにバインドした `HttpServer` を起動し、リダイレクトパスに `?code=` を
     捕捉するハンドラを登録し、任意で（macOS のみ、`exec('open ...')` 経由で）URL をブラウザで開く。
     さらにこれと並行して、ユーザーにコードを手動で貼り付けさせる `readline` プロンプトを走らせ、
     どちらか早く解決した方が勝つ。サーバーは必ず `finally` でクローズされる。
  3. `requestAccessToken(code)` — `accessTokenUri` に POST し、結果を `saveAccessToken()` で永続化する
     （`created_at` を打刻する）。
  - トークンの状態は意図的にファイルベース（`DEFAULT_TOKEN_FILE_PATH = './.accesstoken.json'`）であり、
     メモリ内だけではない — これにより `autoAuthorize()` を繰り返し呼んでもブラウザフローをスキップできる。
  - `now`/`platform` は `AutoOauthOptions` 経由で注入可能になっている。これはテストが有効期限ロジックや
     OS 依存のブラウザ起動挙動を決定的に制御できるようにするためである。

- **`lib/http-server.ts`** — Node の `http` モジュールを薄くラップした `HttpServer`。OAuth のリダイレクトを
  1回だけ捕捉するために使われる。パスごとのハンドラ登録（`setHandler(path, handler)`）をサポートし、
  マッチしないパスは 404 になる。汎用ルーターではなく、`redirectUri` のコールバックを受け取るためだけに
  存在する。

- **`lib/cli-parser.ts`** — `CliParser` は `oauthClientId`/`oauthSecretKey` を、優先度が高い順に3つの
  ソースから解決する: 環境変数（`AAUTH_CLIENT_ID`/`AAUTH_SECRET_KEY`）→ コンストラクタオプション →
  CLI 引数（`--client-id`/`-c`、`--secret-key`/`-s`、`argv` 配列が渡された場合に `commander` でパース）。
  `AutoOauth2` のコンストラクタは、`options` に `oauthClientId`/`oauthSecretKey` が直接設定されていない
  場合にのみ、これを使って値を埋める。

## テストの規約

- テストは `lib/__tests__/` に配置される（ソースとは同じ場所に置かない）。ファイル名は `test-*.ts`。
  Jest は `jest.config.js` で設定されており、`roots: ['<rootDir>/lib']`、`testRegex` は
  `__tests__/*` と `*.test.ts`/`*.spec.ts` の両方にマッチする。
- `lib/__mocks__/child_process.js` と `lib/__mocks__/readline.js` は、`test-auto-oauth2.ts` 内で
  `jest.mock('readline')` / `jest.mock('child_process')` とともに使われる手動 Jest モックであり、
  実際にブラウザを開いたり stdin でブロックしたりするのを避けるために使う — readline のモックは
  `_mockInput` で自動的に応答する。テストで特定の貼り付けコードをシミュレートしたい場合は、モック
  モジュールの `_mockInput` を更新すること。`exec('open ...')` は `platform === 'darwin'` のときにしか
  呼ばれないため、テストはこの経路を決定的に通す/避けるために `AutoOauthOptions` 経由で `platform` を
  明示的に渡している。
- プライベートメソッド（例: `loadAccessToken`、`requestAuthorizeCode`）は、インスタンスを `as any` に
  キャストして直接テストされている — これはこのコードベースで確立されたパターンであり、避けるべき
  回避策ではない。
- トークンファイルのテストは `tokenSavePath` 経由で `lib/__tests__/` 配下に実ファイル（例: `.token.json`）
  を書き込む — 既存のテストと同様に `finally`/`afterEach` ブロックでクリーンアップすること。
