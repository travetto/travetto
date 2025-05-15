import http from 'node:http';
import http2 from 'node:http2';
import https from 'node:https';
import { pipeline } from 'node:stream/promises';

import { WebBodyUtil, WebCommonUtil, WebDispatcher, WebRequest, WebResponse } from '@travetto/web';
import { BinaryUtil, castTo } from '@travetto/runtime';

import { WebHttpServerHandle, WebSecureKeyPair } from './types.ts';

type WebHttpServerConfig = {
  httpVersion?: '1.1' | '2';
  port: number;
  bindAddress: string;
  sslKeys?: WebSecureKeyPair;
  dispatcher: WebDispatcher;
  logStartup?: boolean;
};

export class WebHttpUtil {

  /**
   * Start an http server
   */
  static async startHttpServer(config: WebHttpServerConfig): Promise<WebHttpServerHandle & { server: http.Server | http2.Http2Server }> {
    const { reject, resolve, promise } = Promise.withResolvers<void>();

    const handler = async (req: http.IncomingMessage | http2.Http2ServerRequest, res: http.ServerResponse | http2.Http2ServerResponse): Promise<void> => {
      const request = this.toWebRequest(req);
      const response = await config.dispatcher.dispatch({ request });
      this.respondToServerResponse(response, res);
    };

    let target: http.Server | http2.Http2Server;
    if (config.httpVersion === '2') {
      if (config.sslKeys) {
        target = http2.createSecureServer(config.sslKeys, handler);
      } else {
        target = http2.createServer(handler);
      }
    } else {
      if (config.sslKeys) {
        target = https.createServer(config.sslKeys, handler);
      } else {
        target = http.createServer(handler);
      }
    }

    target.listen(config.port, config.bindAddress)
      .on('error', reject)
      .on('listening', resolve);

    await promise;

    target.off('error', reject);

    if (config.logStartup ?? true) {
      console.log('Listening', { port: config.port });
    }

    return {
      kill: () => target.close(),
      wait: new Promise<void>(close => target.on('close', close)),
      server: target
    };
  }

  /**
   * Create a web request given a node IncomingMessage
   */
  static toWebRequest(req: http.IncomingMessage | http2.Http2ServerRequest): WebRequest {
    const secure = 'encrypted' in req.socket && !!req.socket.encrypted;
    const [path, query] = (req.url ?? '/').split('?') ?? [];
    return new WebRequest({
      context: {
        connection: {
          ip: req.socket.remoteAddress!,
          host: req.headers.host,
          httpProtocol: secure ? 'https' : 'http',
          port: req.socket.localPort
        },
        httpMethod: castTo(req.method?.toUpperCase()),
        path,
        httpQuery: Object.fromEntries(new URLSearchParams(query)),
      },
      headers: req.headers,
      body: WebBodyUtil.markRaw(req)
    });
  }

  /**
   * Send WebResponse to ServerResponse
   */
  static async respondToServerResponse(webRes: WebResponse, res: http.ServerResponse | http2.Http2ServerResponse): Promise<void> {
    const binaryResponse = new WebResponse({ context: webRes.context, ...WebBodyUtil.toBinaryMessage(webRes) });
    binaryResponse.headers.forEach((v, k) => res.setHeader(k, v));
    res.statusCode = WebCommonUtil.getStatusCode(binaryResponse);
    const body = binaryResponse.body;

    if (BinaryUtil.isReadable(body)) {
      await pipeline(body, res);
    } else {
      if (body) {
        'stream' in res ? res.write(body) : res.write(body);
      }
      res.end();
    }
  }
}