import { CliParserOption } from './cli-parser'
import fs from 'fs'
import readline from 'readline'
import { exec } from 'child_process'
import { URL } from 'url'
import rp from 'request-promise-native'
import HttpServer from './http-server'
import { Address } from 'cluster'
import { AddressInfo } from 'net'

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
}

export type AccessToken = {
  access_token: string
  expires_in?: number
  refresh_token?: string
}

export class AutoOauth2 {
  private accessToken?: AccessToken
  private tokenFilePath: string
  constructor(private options: AutoOauthOptions) {
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
    if (fs.existsSync(this.tokenFilePath)) {
      return JSON.parse(fs.readFileSync(this.tokenFilePath).toString()) as AccessToken
    }
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

    const redirectUri = new URL(this.options.redirectUri)
    const server = new HttpServer({ port: Number(redirectUri.port) })
    server.listen()
    try {
      const code = await new Promise<string>((resolve, reject) => {
        server.setHandler(redirectUri.pathname, (req, res, _, params) => {
          res.writeHead(200)
          res.end('ok')
          const code = params.get('code')
          resolve(code!)
        })

        if (!this.options.noGui) {
          if (this.options.platform == 'darwin') {
            // mac only
            exec(`open '${uri}'`)
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

  private saveAccessToken(token: AccessToken) {
    fs.writeFileSync(this.tokenFilePath, JSON.stringify(token))
    return token
  }
}
