# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`auto-oauth2` is a small npm library (published as `auto-oauth2`) that automates the OAuth2
authorization-code flow for CLI/local tools: it opens the authorize URL, spins up a temporary
local HTTP server to catch the redirect (or prompts the user to paste the code manually), swaps
the code for an access token, and caches the token to a local JSON file (refreshing it via
`refresh_token` when expired).

## Commands

- `npm run build` — compile TypeScript (`lib/**/*` + `index.ts`) to `dist/` via `tsc`.
- `npm run dev` — `tsc --watch`.
- `npm test` — run the Jest test suite.
- Run a single test file: `npx jest lib/__tests__/test-auto-oauth2.ts`
- Run tests matching a name: `npx jest -t "loadAccessToken"`
- `npm run dry-run-publish` — clean `dist/`, build, and inspect the tarball that `npm pack` would publish (no actual publish).

There is no separate lint script in `package.json`, but `tslint.json` (extending
`tslint-plugin-prettier`) and `.prettierrc` define the style: no semicolons, single quotes,
120 print width. Match this style by hand when editing (2-space indent, no semicolons, single
quotes) since there's no `npm run lint` to invoke.

## Architecture

The public API is re-exported from `index.ts`, which just does `export * from './lib/auto-oauth2'`
and `export * from './lib/cli-parser'`. Three files under `lib/` do all the work:

- **`lib/auto-oauth2.ts`** — `AutoOauth2` class, the main entry point. `autoAuthorize()` is the
  whole flow:
  1. `loadAccessToken()` — read `.accesstoken.json` (or `tokenSavePath`); if the token hasn't
     expired (`created_at + expires_in*1000 > now`), return it as-is; if expired but a
     `refresh_token` exists, silently refresh it; otherwise fall through.
  2. `requestAuthorizeCode()` — build the authorize URL from `authorizeUri` + client id/scopes/
     `vendorOptions`, start a `HttpServer` bound to the port from `redirectUri`, register a
     handler on the redirect path to capture `?code=`, optionally `open` the URL in a browser
     (macOS only via `exec('open ...')`), and *also* race that against a `readline` prompt asking
     the user to paste the code manually — whichever resolves first wins. The server is always
     closed in a `finally`.
  3. `requestAccessToken(code)` — POST to `accessTokenUri`, persist the result via
     `saveAccessToken()` (stamps `created_at`).
  - Token state is deliberately file-based (`DEFAULT_TOKEN_FILE_PATH = './.accesstoken.json'`),
    not in-memory-only — this is what makes repeated `autoAuthorize()` calls skip the browser flow.
  - `now`/`platform` are injectable via `AutoOauthOptions` specifically so tests can control
    expiry logic and OS-specific browser-opening behavior deterministically.

- **`lib/http-server.ts`** — `HttpServer`, a minimal wrapper around Node's `http` module used only
  to catch the single OAuth redirect. Supports registering per-path handlers
  (`setHandler(path, handler)`); unmatched paths 404. Not a general-purpose router — it exists
  solely to receive the one `redirectUri` callback.

- **`lib/cli-parser.ts`** — `CliParser` resolves `oauthClientId`/`oauthSecretKey` from three
  sources, in increasing priority: environment variables (`AAUTH_CLIENT_ID`/`AAUTH_SECRET_KEY`) →
  constructor options → CLI args (`--client-id`/`-c`, `--secret-key`/`-s`) parsed via `commander`
  when an `argv` array is passed in. `AutoOauth2`'s constructor uses this to fill in
  `oauthClientId`/`oauthSecretKey` only if they weren't already set directly on `options`.

## Testing conventions

- Tests live in `lib/__tests__/` (not colocated with source) and are named `test-*.ts`; Jest is
  configured via `jest.config.js` with `roots: ['<rootDir>/lib']` and `testRegex` matching both
  `__tests__/*` and `*.test.ts`/`*.spec.ts`.
- `lib/__mocks__/child_process.js` and `lib/__mocks__/readline.js` are manual Jest mocks used with
  `jest.mock('readline')` / `jest.mock('child_process')` in `test-auto-oauth2.ts` to avoid actually
  opening a browser or blocking on stdin — the readline mock auto-answers via `_mockInput`.
  Update `_mockInput` on the mocked module when a test needs to simulate a specific pasted code.
  Since `exec('open ...')` is only triggered when `platform === 'darwin'`, tests pass `platform`
  explicitly via `AutoOauthOptions` to exercise/avoid that path deterministically.
- Private methods (e.g. `loadAccessToken`, `requestAuthorizeCode`) are exercised directly in tests
  by casting the instance `as any` — this is the established pattern in this codebase, not a
  workaround to avoid.
- Token-file tests write real files under `lib/__tests__/` (e.g. `.token.json`) via
  `tokenSavePath` — clean these up in `finally`/`afterEach` blocks as the existing tests do.
