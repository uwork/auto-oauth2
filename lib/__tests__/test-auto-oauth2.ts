import { AutoOauth2, AutoOauthOptions, AccessToken } from '../auto-oauth2'
import fs from 'fs'
import path from 'path'

jest.mock('readline')
jest.mock('child_process')

describe('AutoOauth2', () => {
  // basic pattern
  const test: AutoOauthOptions = {
    oauthClientId: 'clientId',
    oauthSecretKey: 'secretKey',
    authorizeUri: 'http://localhost/auth',
    accessTokenUri: 'http://localhost/token',
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
})
