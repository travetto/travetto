import type net from 'node:net';
import http from 'node:http';
import http2 from 'node:http2';
import https from 'node:https';
import { pipeline } from 'node:stream/promises';
import { TLSSocket } from 'node:tls';

import { WebBodyUtil, WebCommonUtil, type WebDispatcher, WebRequest, WebResponse } from '@travetto/web';
import { BinaryUtil, castTo, ShutdownManager } from '@travetto/runtime';

import type { WebSecureKeyPair, WebServerHandle } from './types.ts';

type HttpServer = http.Server | http2.Http2Server;
type HttpResponse = http.ServerResponse | http2.Http2ServerResponse;
type HttpRequest = http.IncomingMessage | http2.Http2ServerRequest;
type HttpSocket = net.Socket | http2.Http2Stream;

type WebHttpServerConfig = {
  httpVersion?: '1.1' | '2';
  port: number;
  bindAddress: string;
  tlsKeys?: WebSecureKeyPair;
  dispatcher: WebDispatcher;
  signal?: AbortSignal;
};

export class WebHttpUtil {

  /**
   * Build a simple request handler
   * @param dispatcher
   */
  static buildHandler(dispatcher: WebDispatcher): (request: HttpRequest, response: HttpResponse) => Promise<void> {
    return async (request: HttpRequest, response: HttpResponse): Promise<void> => {
      const webRequest = this.toWebRequest(request);
      const webResponse = await dispatcher.dispatch({ request: webRequest });
      this.respondToServerResponse(webResponse, response);
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
      if (config.tlsKeys) {
        target = http2.createSecureServer(config.tlsKeys, handler);
      } else {
        target = http2.createServer(handler);
      }
    } else {
      if (config.tlsKeys) {
        target = https.createServer(config.tlsKeys, handler);
      } else {
        target = http.createServer(handler);
      }
    }

    const complete = new Promise<void>(onClose => target.on('close', onClose));

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

    ShutdownManager.signal.addEventListener('abort', () => stop(false));
    config.signal?.addEventListener('abort', () => stop(true));

    return { target, complete, stop };
  }

  /**
   * Create a WebRequest given an incoming http request
   */
  static toWebRequest(request: HttpRequest): WebRequest {
    const secure = request.socket instanceof TLSSocket;
    const [path, query] = (request.url ?? '/').split('?') ?? [];
    return new WebRequest({
      context: {
        connection: {
          ip: request.socket.remoteAddress!,
          host: request.headers.host,
          httpProtocol: secure ? 'https' : 'http',
          port: request.socket.localPort
        },
        httpMethod: castTo(request.method?.toUpperCase()),
        path,
        httpQuery: Object.fromEntries(new URLSearchParams(query)),
      },
      headers: request.headers,
      body: WebBodyUtil.markRawBinary(request)
    });
  }

  /**
   * Send WebResponse to outbound http response
   */
  static async respondToServerResponse(webResponse: WebResponse, response: HttpResponse): Promise<void> {
    const binaryResponse = new WebResponse({ context: webResponse.context, ...WebBodyUtil.toBinaryMessage(webResponse) });
    binaryResponse.headers.forEach((value, key) => response.setHeader(key, value));
    response.statusCode = WebCommonUtil.getStatusCode(binaryResponse);
    const body = binaryResponse.body;

    if (BinaryUtil.isByteStream(body)) {
      await pipeline(body, response);
    } else {
      if (body) {
        const bytes = await BinaryUtil.toBuffer(body);
        // Weird type union that http2 uses
        'stream' in response ? response.write(bytes) : response.write(bytes);
      }
      response.end();
    }
  }
}