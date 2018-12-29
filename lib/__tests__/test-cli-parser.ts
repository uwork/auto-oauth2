import { CliParser } from '../cli-parser'

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
})
