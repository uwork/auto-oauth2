import { AutoOauth2 } from './lib/auto-oauth2'

const main = async () => {
  const client = require('../client_secret.json').installed
  const auth2 = new AutoOauth2({
    oauthClientId: client.client_id,
    oauthSecretKey: client.client_secret,
    authorizeUri: client.auth_uri,
    accessTokenUri: client.token_uri,
    redirectUri: client.redirect_uris[0],
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    responseType: 'code'
  })
  const token = await auth2.autoAuthorize()
  console.log(token)
}

main()
