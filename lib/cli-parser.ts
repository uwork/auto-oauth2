import { Command } from 'commander'

export type CliParserOption = {
  /**
   * command line arguments.
   */
  argv?: string[]

  /**
   * OAuth client id
   */
  oauthClientId?: string

  /**
   * OAuth secret key
   */
  oauthSecretKey?: string
}

export class CliParser {
  oauthClientId?: string
  oauthSecretKey?: string

  /**
   * parse cli arguments.
   *
   * @param options parser options.
   * or
   * process.env.AAUTH_CLIENT_ID
   * process.env.AAUTH_SECRET_ID
   */
  constructor(options: CliParserOption = {}) {
    this.oauthClientId = options.oauthClientId || process.env.AAUTH_CLIENT_ID
    this.oauthSecretKey = options.oauthSecretKey || process.env.AAUTH_SECRET_KEY
    if (options.argv && 0 < options.argv.length) {
      const program = new Command()
      program
        .option('-c, --client-id [value]', 'OAuth Client ID')
        .option('-s, --secret-key [value]', 'OAuth Secret Key')
        .parse(options.argv)

      const opts = program.opts()
      if (opts.clientId) {
        this.oauthClientId = opts.clientId
      }
      if (opts.secretKey) {
        this.oauthSecretKey = opts.secretKey
      }
    }
  }
}
