import HttpServer from '../http-server'
import http, { IncomingMessage } from 'http'
import net from 'net'
import { URL } from 'url'
import rp from 'request-promise-native'

const TEST_PORT = 20472

// http test helper
type HttpResult = {
  response: IncomingMessage
  responseBody?: string
}
const _testRequest = (path: string, method: string, body?: string) => {
  const uri = new URL(`http://localhost:${TEST_PORT}${path}`)
  console.log(`request: ${uri.href}`)
  return rp({ uri, method, body, resolveWithFullResponse: true }).then(r => {
    console.log(Object.keys(r))
    return { response: r, responseBody: r.body } as HttpResult
  })
}
const testGet = (path: string) => {
  return _testRequest(path, 'GET')
}
const testPost = (path: string, body: string) => {
  return _testRequest(path, 'POST', body)
}

describe('http-server', () => {
  describe('listen', () => {
    it('connect', async () => {
      const server = new HttpServer({ port: TEST_PORT })
      server.listen()

      expect.assertions(2)
      expect(server.server).toBeDefined()
      const socket = net.connect({ host: 'localhost', port: TEST_PORT })

      try {
        const result = await new Promise((resolve, reject) => {
          socket.on('connect', () => {
            resolve(true)
          })
          socket.on('error', e => {
            reject(e)
          })
        })
        expect(result).toBeTruthy()
      } finally {
        socket.destroy()
        server.close()
      }
    })

    it('200 OK', async () => {
      const server = new HttpServer({ port: TEST_PORT })
      server.setHandler('/', (_, res) => {
        res.writeHead(200, 'OK')
        res.end('ok')
      })
      server.listen()
      try {
        const { response: resp } = await testGet('/')
        expect(resp).toBeDefined()
        expect(resp.statusCode).toBe(200)
        expect(resp.statusMessage).toBe('OK')
      } finally {
        server.close()
      }
    })

    it('404 Not Found', async () => {
      const server = new HttpServer({ port: TEST_PORT })
      server.listen()
      try {
        await expect(testGet('/')).rejects.toThrow('404 - ""')
      } finally {
        server.close()
      }
    })

    it('request parameters', async () => {
      const server = new HttpServer({ port: TEST_PORT })
      expect.assertions(10)
      server.setHandler('/test', (_, res, __, params) => {
        res.writeHead(200, 'OK')
        res.end('result ok')
        expect(params).toBeDefined()
        expect(params.has('key')).toBeTruthy()
        expect(params.get('key')).toBe('value')
        expect(params.has('key2')).toBeTruthy()
        expect(params.get('key2')).toBe('値2')
        expect(params.has('key3')).toBeTruthy()
        expect(params.get('key3')).toBe('value3')
      })
      server.listen()
      try {
        const { response: resp } = await testGet('/test?key=value&key2=値2&key3=value3&key3=value3-2')
        expect(resp).toBeDefined()
        expect(resp.statusCode).toBe(200)
        expect(resp.statusMessage).toBe('OK')
      } finally {
        server.close()
      }
    })

    it('request body', async () => {
      const server = new HttpServer({ port: TEST_PORT })
      expect.assertions(5)
      server.setHandler('/test', (_, res, body) => {
        res.writeHead(200, 'OK')
        res.end('result ok')
        expect(body).toBeDefined()
        expect(body).toBe('body data')
      })
      server.listen()
      try {
        const { response: resp } = await testPost('/test', 'body data')
        expect(resp).toBeDefined()
        expect(resp.statusCode).toBe(200)
        expect(resp.statusMessage).toBe('OK')
      } finally {
        server.close()
      }
    })

    it('response body', async () => {
      const server = new HttpServer({ port: TEST_PORT })
      expect.assertions(4)
      server.setHandler('/test', (_, res) => {
        res.writeHead(200, 'OK')
        res.end('result ok')
      })
      server.listen()
      try {
        const { response: resp, responseBody } = await testPost('/test', 'body data')
        expect(resp).toBeDefined()
        expect(resp.statusCode).toBe(200)
        expect(resp.statusMessage).toBe('OK')
        expect(responseBody).toBe('result ok')
      } finally {
        server.close()
      }
    })
  })
})
