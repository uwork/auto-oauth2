import { AutoOauth2, AutoOauthOptions, AccessToken } from '../auto-oauth2'
import fs from 'fs'
import path from 'path'
import HttpServer from '../http-server'

jest.mock('readline')
jest.mock('child_process')

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

  describe('loadAccessToken', () => {
    it('exists token file', async () => {
      const tokenFilePath = path.resolve(__dirname, '.token.json')
      const accessToken: AccessToken = {
        access_token: 'accessToken',
        expires_in: 3600,
        refresh_token: 'refreshToken'
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
})
