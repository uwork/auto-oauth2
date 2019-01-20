import { CliParserOption, CliParser } from './cli-parser'
import fs from 'fs'
import readline from 'readline'
import { exec } from 'child_process'
import { URL } from 'url'
import rp from 'request-promise-native'
import HttpServer from './http-server'

const DEFAULT_TOKEN_FILE_PATH = './.accesstoken.json'

export type AutoOauthOptions = CliParserOption & {
  authorizeUri: string
  redirectUri: string
  accessTokenUri: string
  responseType?: 'code' | 'token' | 'code_and_token'
  scopes: string[]
  noGui?: boolean
  platform?: string
  tokenSavePath?: string
  now?: Date
  vendorOptions?: { [key: string]: string }
}

export type AccessToken = {
  access_token: string
  expires_in: number
  refresh_token?: string
  created_at: number
}

export class AutoOauth2 {
  private accessToken?: AccessToken
  private tokenFilePath: string
  constructor(private options: AutoOauthOptions) {
    const parser = new CliParser(options)
    if (!options.oauthClientId && parser.oauthClientId) {
      options.oauthClientId = parser.oauthClientId
    }
    if (!options.oauthSecretKey && parser.oauthSecretKey) {
      options.oauthSecretKey = parser.oauthSecretKey
    }
    if (!options.responseType) {
      options.responseType = 'code'
    }
    this.tokenFilePath = this.options.tokenSavePath || DEFAULT_TOKEN_FILE_PATH
    this.options.platform = this.options.platform || process.platform
  }

  async autoAuthorize(): Promise<AccessToken> {
    this.accessToken = await this.loadAccessToken()
    if (this.accessToken) {
      return this.accessToken
    }

    const code = await this.requestAuthorizeCode()
    const token = await this.requestAccessToken(code)
    return token
  }

  /**
   * load access token from file.
   */
  private async loadAccessToken() {
    if (!fs.existsSync(this.tokenFilePath)) {
      return undefined
    }

    const token = JSON.parse(fs.readFileSync(this.tokenFilePath).toString()) as AccessToken

    const now = (this.options.now || new Date()).getTime()
    if (token.created_at + token.expires_in! * 1000 > now) {
      return token
    }

    if (token.refresh_token) {
      // require refresh
      return this.refreshAccessToken(token.refresh_token)
    }

    console.warn('expired access token.')

    return undefined
  }

  /**
   * open authorize uri.
   */
  private async requestAuthorizeCode() {
    const uri = new URL(this.options.authorizeUri)
    uri.searchParams.append('client_id', this.options.oauthClientId!)
    uri.searchParams.append('redirect_uri', this.options.redirectUri)
    uri.searchParams.append('scope', this.options.scopes.join(' '))
    if (this.options.responseType) uri.searchParams.append('response_type', this.options.responseType)
    if (this.options.vendorOptions) {
      for (const key of Object.keys(this.options.vendorOptions)) {
        const val = this.options.vendorOptions[key]
        uri.searchParams.append(key, val)
      }
    }

    const redirectUri = new URL(this.options.redirectUri)
    const server = new HttpServer({ port: Number(redirectUri.port) })
    server.listen()
    try {
      const code = await new Promise<string>((resolve, reject) => {
        server.setHandler(redirectUri.pathname, (req, res, _, params) => {
          rl.pause().close()
          const code = params.get('code')
          res.writeHead(200)
          res.end(JSON.stringify({ code }))
          resolve(code!)
        })

        if (!this.options.noGui) {
          if (this.options.platform == 'darwin') {
            // mac only
            exec(`open '${uri}' &`)
          }
        }
        console.log(`open authorize uri: ${uri}`)
        const rl = readline.createInterface(process.stdin, process.stdout)
        rl.question('input code: ', code => {
          rl.close()
          if (!code) {
            return reject(Error('empty code.'))
          }
          console.log(`code: ${code}`)
          resolve(code)
        })
      })
      return code as string
    } finally {
      server.close()
    }
  }

  private async requestAccessToken(code: string, grantType: string = 'authorization_code') {
    const body = {
      code,
      client_id: this.options.oauthClientId,
      client_secret: this.options.oauthSecretKey,
      grant_type: grantType,
      redirect_uri: this.options.redirectUri
    }
    const token = await rp(this.options.accessTokenUri, {
      body: JSON.stringify(body),
      method: 'POST'
    })
    console.log('receive access token:', token)
    return this.saveAccessToken(JSON.parse(token))
  }

  private async refreshAccessToken(refreshToken: string) {
    const body = {
      grant_type: 'refresh_token',
      client_id: this.options.oauthClientId,
      client_secret: this.options.oauthSecretKey,
      refresh_token: refreshToken
    }
    const token = await rp(this.options.accessTokenUri, {
      method: 'POST',
      body: JSON.stringify(body)
    })
    console.log('refreshed access token:', token)
    return this.saveAccessToken(JSON.parse(token))
  }

  private saveAccessToken(token: AccessToken) {
    const saveToken = {
      ...token,
      created_at: +(this.options.now || new Date())
    }
    fs.writeFileSync(this.tokenFilePath, JSON.stringify(saveToken))
    return saveToken
  }
}
