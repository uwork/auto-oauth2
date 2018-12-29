import { CliParser, ParserOption } from '../cli-parser'

describe('cli-parser', () => {
  it('cli args', () => {
    const tests = [
      ['node', 'command', '--client-id', 'clientId', '--secret-key', 'secretKey'],
      ['node', 'command', '-c', 'clientId', '-s', 'secretKey']
    ]
    for (const argv of tests) {
      const params = new CliParser({ argv })

      expect(params.oauthClientId).toBe(argv[3])
      expect(params.oauthSecretKey).toBe(argv[5])
    }
  })

  it('option args', () => {
    const tests: ParserOption[] = [{ oauthClientId: 'clientId', oauthSecretKey: 'secretId' }]
    for (const opts of tests) {
      const params = new CliParser(opts)

      expect(params.oauthClientId).toBe(opts.oauthClientId)
      expect(params.oauthSecretKey).toBe(opts.oauthSecretKey)
    }
  })

  it('env args', () => {
    const tests: ParserOption[] = [{ oauthClientId: 'clientId', oauthSecretKey: 'secretId' }]
    for (const opts of tests) {
      process.env.AAUTH_CLIENT_ID = opts.oauthClientId
      process.env.AAUTH_SECRET_KEY = opts.oauthSecretKey
      const params = new CliParser()

      expect(params.oauthClientId).toBe(opts.oauthClientId)
      expect(params.oauthSecretKey).toBe(opts.oauthSecretKey)
    }
  })
})
