import http, { IncomingMessage, ServerResponse } from 'http'
import { URL, URLSearchParams } from 'url'

export type HttpServerOptions = {
  port: number
  hostname?: string
}

export type HttpRequestListener = (
  req: IncomingMessage,
  res: ServerResponse,
  requestBody: string,
  params: URLSearchParams
) => void

export default class HttpServer {
  server: http.Server
  handlers: { [key: string]: HttpRequestListener }
  constructor(private options: HttpServerOptions) {
    this.server = http.createServer(this.serve.bind(this))
    this.handlers = {}
  }

  listen() {
    this.server.listen(this.options.port, this.options.hostname)
  }

  close() {
    this.server.close()
  }

  setHandler(path: string, handler: HttpRequestListener) {
    this.handlers[path] = handler
  }

  clearHandlers() {
    this.handlers = {}
  }

  private async serve(req: http.IncomingMessage, res: ServerResponse) {
    const uri = new URL(`http://localhost:${this.options.port}${req.url!}`)
    if (!req.url) {
      res.writeHead(400, 'Bad Request')
      res.end()
      return
    }

    if (this.handlers[uri.pathname]) {
      const handler = this.handlers[uri.pathname]
      const requestBody = await new Promise<string>(resolve => {
        let buffs = ''
        req.setEncoding('utf-8')
        req.on('data', chunk => {
          buffs += chunk
        })
        req.on('end', () => {
          resolve(buffs)
        })
      })
      handler(req, res, requestBody, uri.searchParams)
    } else {
      res.writeHead(404, 'Not Found')
      res.end()
    }
  }
}
