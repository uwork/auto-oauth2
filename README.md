# What is this?

this package is a oauth library to use easy.

# Install

```bash
$ npm install auto-oauth2
```

# How to use

```javascript
// index.js
const { AutoOauth2 } = require('auto-oauth2')

const oauth2 = new AutoOauth2({
  authorizeUri: 'https://.../auth',
  accessTokenUri: 'https://.../token',
  redirectUri: 'http://localhost:8444/code',
  oauthClientId: 'client-id',
  oauthSecretKey: 'client-secret',
  scopes: ['scope1', 'scope2']
})
oauth2.autoAuthorize().then(token => {
  console.log('created token:', token)
})
```

```bash
$ node index.js
open authorize uri: https://.../auth?client_id=client-id...
# open browser
input code: [input code] # internal browser receive auth code.
created token: {
  "access_token": "...",
  "expires_in": 999,
  "refresh_token": "...",
}
```

# OAuth config

## Environment config

```bash
$ export AAUTH_CLIENT_ID=client_id
$ export AAUTH_SECRET_KEY=client_secret
```

## Command-line-interface config

```bash
$ node index.js --client-id [client_id] --secret-key [client_secret]
or
$ node index.js -c [client_id] -s [client_secret]
```

```javascript
// index.js
const { AutoOauth2 } = require('auto-oauth2')

const oauth2 = new AutoOauth2({
  argv: process.argv,
  authorizeUri: 'https://.../auth',
  accessTokenUri: 'https://.../token',
  redirectUri: 'http://localhost:8444/code',
  scopes: ['scope1', 'scope2']
})
oauth2.autoAuthorize().then(token => {
  console.log(token)
})
```

# Disable open browser

Config for command line application.

```javascript
const oauth2 = new AutoOauth2({
  authorizeUri: 'https://.../auth',
  accessTokenUri: 'https://.../token',
  redirectUri: 'http://.../callback', // configure redirect url
  scopes: ['scope1', 'scope2'],
  noGui: true // disabled open browser
})
```

# License

see [LICENSE](LICENSE).

# Disclaimer

no guarantee.
