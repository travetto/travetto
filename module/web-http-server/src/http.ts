import net from 'node:net';
import http from 'node:http';
import http2 from 'node:http2';
import https from 'node:https';
import { pipeline } from 'node:stream/promises';
import { TLSSocket } from 'node:tls';

import { WebBodyUtil, WebCommonUtil, WebDispatcher, WebRequest, WebResponse } from '@travetto/web';
import { BinaryUtil, castTo, ShutdownManager } from '@travetto/runtime';

import { WebSecureKeyPair, WebServerHandle } from './types.ts';

type HttpServer = http.Server | http2.Http2Server;
type HttpResponse = http.ServerResponse | http2.Http2ServerResponse;
type HttpRequest = http.IncomingMessage | http2.Http2ServerRequest;
type HttpSocket = net.Socket | http2.Http2Stream;

type WebHttpServerConfig = {
  httpVersion?: '1.1' | '2';
  port: number;
  bindAddress: string;
  sslKeys?: WebSecureKeyPair;
  dispatcher: WebDispatcher;
  signal?: AbortSignal;
};

export class WebHttpUtil {

  /**
   * Build a simple request handler
   * @param dispatcher
   */
  static buildHandler(dispatcher: WebDispatcher): (req: HttpRequest, res: HttpResponse) => Promise<void> {
    return async (req: HttpRequest, res: HttpResponse): Promise<void> => {
      const request = this.toWebRequest(req);
      const response = await dispatcher.dispatch({ request });
      this.respondToServerResponse(response, res);
    };
  }

  /**
   * Start an http server
   */
  static async startHttpServer(config: WebHttpServerConfig): Promise<WebServerHandle<HttpServer>> {
    const { reject, resolve, promise } = Promise.withResolvers<void>();

    const handler = this.buildHandler(config.dispatcher);

    let target: HttpServer;
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

    const complete = new Promise<void>(r => target.on('close', r));

    // Track connections for shutdown
    const activeConnections = new Set<HttpSocket>();
    target.on('connection', (socket: HttpSocket) => {
      activeConnections.add(socket);
      socket.on('close', () => activeConnections.delete(socket));
    });

    target.listen(config.port, config.bindAddress)
      .on('error', reject)
      .on('listening', resolve);

    await promise;

    target.off('error', reject);

    async function stop(immediate?: boolean): Promise<void> {
      if (!target.listening) {
        return;
      }
      console.debug('Stopping http server');
      target.close();
      if (immediate) {
        for (const connection of activeConnections) {
          if (!connection.destroyed) {
            connection.destroy();
          }
        }
      }
      return complete;
    }

    ShutdownManager.onGracefulShutdown(() => stop(false));
    config.signal?.addEventListener('abort', () => stop(true));

    return { target, complete, stop };
  }

  /**
   * Create a WebRequest given an incoming http request
   */
  static toWebRequest(req: HttpRequest): WebRequest {
    const secure = req.socket instanceof TLSSocket;
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
   * Send WebResponse to outbound http response
   */
  static async respondToServerResponse(webRes: WebResponse, res: HttpResponse): Promise<void> {
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