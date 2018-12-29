import commander from 'commander'
const pjson = require('../package.json')

export type ParserOption = {
  argv?: string[]
  oauthClientId?: string
  oauthSecretKey?: string
}

export class CliParser {
  oauthClientId?: string
  oauthSecretKey?: string

  /**
   * CLI引数をパースします
   *
   * @param options 引数
   */
  constructor(options: ParserOption) {
    this.oauthClientId = options.oauthClientId || process.env.OAUTH_CLIENT_ID
    this.oauthSecretKey = options.oauthSecretKey || process.env.OAUTH_SECRET_KEY
    if (options.argv && 0 < options.argv.length) {
      commander
        .version(pjson.version)
        .option('-c, --client-id [value]', 'OAuth Client ID')
        .option('-s, --secret-key [value]', 'OAuth Secret Key')
        .parse(options.argv)

      if (commander.clientId) {
        this.oauthClientId = commander.clientId
      }
      if (commander.secretKey) {
        this.oauthSecretKey = commander.secretKey
      }
    }
  }
}
