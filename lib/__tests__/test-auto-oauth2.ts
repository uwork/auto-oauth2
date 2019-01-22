import { AutoOauth2, AutoOauthOptions, AccessToken } from '../auto-oauth2'
import fs from 'fs'
import path from 'path'
import HttpServer from '../http-server'
import { CliParserOption } from '../cli-parser'

jest.mock('readline')
jest.mock('child_process')

const TEST_DATE = new Date(2019, 1, 3, 11, 22, 33).getTime()

describe('AutoOauth2', () => {
  // basic pattern
  const test: AutoOauthOptions = {
    oauthClientId: 'clientId',
    oauthSecretKey: 'secretKey',
    authorizeUri: 'http://localhost/auth',
    accessTokenUri: 'http://localhost:1234/token',
    redirectUri: 'http://localhost/callback',
    scopes: ['scope1', 'scope2']
  }

  describe('constructor', () => {
    it('cli args', () => {
      const tests = [
        ['node', 'command', '--client-id', 'clientId', '--secret-key', 'secretKey'],
        ['node', 'command', '-c', 'clientId', '-s', 'secretKey']
      ]
      for (const argv of tests) {
        const oauth2 = new AutoOauth2({ ...test, argv }) as any

        expect(oauth2.options.oauthClientId).toBe(argv[3])
        expect(oauth2.options.oauthSecretKey).toBe(argv[5])
      }
    })

    it('option args', () => {
      const opts: CliParserOption = {
        oauthClientId: 'clientId',
        oauthSecretKey: 'secretId'
      }
      const oauth2 = new AutoOauth2({ ...test, ...opts }) as any

      expect(oauth2.options.oauthClientId).toBe(opts.oauthClientId)
      expect(oauth2.options.oauthSecretKey).toBe(opts.oauthSecretKey)
    })

    it('env args', () => {
      const opts: CliParserOption = {
        oauthClientId: 'clientId',
        oauthSecretKey: 'secretId'
      }

      process.env.AAUTH_CLIENT_ID = opts.oauthClientId
      process.env.AAUTH_SECRET_KEY = opts.oauthSecretKey
      const oauth2 = new AutoOauth2({ ...test, ...opts }) as any

      expect(oauth2.options.oauthClientId).toBe(opts.oauthClientId)
      expect(oauth2.options.oauthSecretKey).toBe(opts.oauthSecretKey)
    })
  })

  describe('loadAccessToken', () => {
    it('exists token file', async () => {
      const tokenFilePath = path.resolve(__dirname, '.token.json')
      const accessToken: AccessToken = {
        access_token: 'accessToken',
        expires_in: 3600,
        refresh_token: 'refreshToken',
        created_at: TEST_DATE
      }
      fs.writeFileSync(tokenFilePath, JSON.stringify(accessToken))

      try {
        const oauth2 = new AutoOauth2({
          ...test,
          tokenSavePath: tokenFilePath
        }) as any
        const token = await (oauth2.loadAccessToken() as Promise<AccessToken>)

        expect(token).toBeDefined()
        expect(token.access_token).toBe(accessToken.access_token)
        expect(token.expires_in).toBe(accessToken.expires_in)
        expect(token.refresh_token).toBe(accessToken.refresh_token)
        expect(token.created_at).toBe(accessToken.created_at)
      } finally {
        fs.unlinkSync(tokenFilePath)
      }
    })

    it('not exists token file', async () => {
      const oauth2 = new AutoOauth2(test) as any
      if (fs.existsSync(oauth2.tokenFilePath)) {
        fs.unlinkSync(oauth2.tokenFilePath)
      }
      const token = await (oauth2.loadAccessToken() as Promise<AccessToken>)

      expect(token).toBeUndefined()
    })

    it('expired token', async () => {
      const tokenFilePath = path.resolve(__dirname, '.token.json')
      const accessToken: AccessToken = {
        access_token: 'accessToken',
        expires_in: 3600,
        refresh_token: 'refreshToken',
        created_at: TEST_DATE - 10000 * 1000
      }
      fs.writeFileSync(tokenFilePath, JSON.stringify(accessToken))
      const oauth2 = new AutoOauth2(test) as any
      if (fs.existsSync(oauth2.tokenFilePath)) {
        fs.unlinkSync(oauth2.tokenFilePath)
      }

      try {
        const oauth2 = new AutoOauth2({
          ...test,
          tokenSavePath: tokenFilePath,
          now: new Date(TEST_DATE)
        }) as any

        // return dummy refreshed token
        const token2: AccessToken = {
          access_token: 'accessToken2',
          expires_in: 2400,
          refresh_token: 'refreshToken2',
          created_at: TEST_DATE + 2400 * 1000
        }
        expect.assertions(6)
        oauth2.refreshAccessToken = async (token: string) => {
          expect(token).toBe('refreshToken')
          return token2
        }

        const token = await (oauth2.loadAccessToken() as Promise<AccessToken>)
        expect(token).toBeDefined()
        expect(token.access_token).toBe(token2.access_token)
        expect(token.expires_in).toBe(token2.expires_in)
        expect(token.refresh_token).toBe(token2.refresh_token)
        expect(token.created_at).toBe(token2.created_at)
      } finally {
        fs.unlinkSync(tokenFilePath)
      }
    })
  })

  describe('requestAuthorizeCode', () => {
    it('mock stdin', async () => {
      const oauth2 = new AutoOauth2({
        ...test,
        noGui: true
      }) as any

      const rl = require('readline')
      rl._mockInput = 'test'
      const code = await oauth2.requestAuthorizeCode()
      expect(code).toBeDefined()
      expect(code).toBe(rl._mockInput)
    })

    it('input empty code', async () => {
      const oauth2 = new AutoOauth2({
        ...test,
        noGui: true
      }) as any

      const rl = require('readline')
      rl._mockInput = ''
      expect(oauth2.requestAuthorizeCode()).rejects.toThrow('empty code.')
    })
  })

  describe('requestAccessToken', () => {
    it('get access token', async () => {
      const oauth2 = new AutoOauth2(test) as any
      const DUMMY_AUTH_CODE = 'code'

      const server = new HttpServer({ port: 1234 })
      expect.assertions(5)
      server.setHandler('/token', (_, res, requestBody) => {
        const reqestJson = JSON.parse(requestBody)
        expect(reqestJson.code).toBe(DUMMY_AUTH_CODE)

        // return dummy access_token
        res.writeHead(200)
        res.end(
          JSON.stringify({
            access_token: 'token',
            expires_in: 1200,
            refresh_token: 'refresh'
          } as AccessToken)
        )
      })
      server.listen()
      try {
        const token = await oauth2.requestAccessToken(DUMMY_AUTH_CODE)
        expect(token).toBeDefined()
        expect(token.access_token).toBe('token')
        expect(token.expires_in).toBe(1200)
        expect(token.refresh_token).toBe('refresh')
      } finally {
        server.close()
        if (fs.existsSync(oauth2.tokenFilePath)) {
          fs.unlinkSync(oauth2.tokenFilePath)
        }
      }
    })

    it('token api error', async () => {
      const oauth2 = new AutoOauth2(test) as any
      const DUMMY_AUTH_CODE = 'code'

      const server = new HttpServer({ port: 1234 })
      expect.assertions(5)
      server.setHandler('/token', (_, res, requestBody) => {
        const reqestJson = JSON.parse(requestBody)
        expect(reqestJson.code).toBe(DUMMY_AUTH_CODE)

        // return dummy access_token
        res.writeHead(503, 'invalid code')
        res.end('invalid authorize code')
      })
      server.listen()
      try {
        await oauth2.requestAccessToken(DUMMY_AUTH_CODE)
      } catch (e) {
        expect(e).toBeDefined()
        expect(e.statusCode).toBe(503)
        expect(e.response.statusMessage).toBe('invalid code')
        expect(e.error).toBe('invalid authorize code')
      } finally {
        server.close()
        if (fs.existsSync(oauth2.tokenFilePath)) {
          fs.unlinkSync(oauth2.tokenFilePath)
        }
      }
    })
  })

  describe('refreshAccessToken', () => {
    it('token refresh', async () => {
      const tokenFilePath = path.resolve(__dirname, '.token.json')
      const accessToken: AccessToken = {
        access_token: 'accessToken',
        expires_in: 3600,
        refresh_token: 'refreshToken',
        created_at: TEST_DATE - 10000 * 1000
      }
      fs.writeFileSync(tokenFilePath, JSON.stringify(accessToken))

      const oauth2 = new AutoOauth2({ ...test, now: new Date(TEST_DATE) }) as any

      const server = new HttpServer({ port: 1234 })
      expect.assertions(7)
      server.setHandler('/token', (_, res, requestBody) => {
        const reqestJson = JSON.parse(requestBody)
        expect(reqestJson.client_id).toBe(test.oauthClientId)
        expect(reqestJson.client_secret).toBe(test.oauthSecretKey)
        expect(reqestJson.refresh_token).toBe(accessToken.refresh_token!)

        res.writeHead(200)
        res.end(
          JSON.stringify({
            access_token: 'token',
            expires_in: 1200,
          } as AccessToken)
        )
      })
      server.listen()
      try {
        const token = await oauth2.refreshAccessToken(accessToken.refresh_token)
        expect(token.access_token).toBe('token')
        expect(token.expires_in).toBe(1200)
        expect(token.refresh_token).toBe(accessToken.refresh_token)
        expect(token.created_at).toBe(TEST_DATE)
      } finally {
        server.close()
        if (fs.existsSync(tokenFilePath)) {
          fs.unlinkSync(tokenFilePath)
        }
        if (fs.existsSync(oauth2.tokenFilePath)) {
          fs.unlinkSync(oauth2.tokenFilePath)
        }
      }
    })
  })
})
