import commander from 'commander'
const pjson = require('../package.json')

export type ParserOption = {
  argv?: string[]
  oauthClientId?: string
  oauthSecretKey?: string
}

export class CliParser {
  oauthClientId: string
  oauthSecretKey: string

  constructor(params: ParserOption) {
    this.oauthClientId = params.oauthClientId || process.env.OAUTH_CLIENT_ID
    this.oauthSecretKey = params.oauthSecretKey || process.env.OAUTH_SECRET_KEY
    if (null !== params.argv && 0 < params.argv.length) {
      commander
        .version(pjson.version)
        .option('-c, --oauth-client-id', 'OAuth Client ID')
        .option('-s, --oauth-secret-key', 'OAuth Secret Key')
        .parse(params.argv)

      if (commander.oauthClientId) {
        this.oauthClientId = commander.oauthClientId
      }
      if (commander.oauthSecretKey) {
        this.oauthSecretKey = commander.oauthSecretKey
      }
    }
  }
}
