import http, { IncomingMessage, ServerResponse } from 'node:http';
import https from 'node:https';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

import { Inject, Injectable } from '@travetto/di';
import { WebConfig, WebServer, WebServerHandle, WebRouter, WebRequest } from '@travetto/web';
import { castTo, hasFunction } from '@travetto/runtime';

const isReadable = hasFunction<Readable>('pipe');

/**
 * An express http server
 */
@Injectable()
export class NodeWebServer implements WebServer {

  handler?: (req: IncomingMessage, res: ServerResponse) => void;

  @Inject()
  config: WebConfig;

  async init(): Promise<void> { }

  registerRouter(router: WebRouter): void {
    this.handler = async (req, res): Promise<void> => {
      const { endpoint, params } = router(req);

      const secure = 'encrypted' in req.socket && !!req.socket.encrypted;
      const url = new URL(`http${secure ? 's' : ''}://${req.headers.host}${req.url}`);

      const httpReq = new WebRequest({
        protocol: secure ? 'https' : 'http',
        method: castTo(req.method?.toUpperCase()),
        path: url.pathname!,
        query: Object.fromEntries(url.searchParams.entries()),
        params,
        headers: req.headers,
        inputStream: req,
        remoteIp: req.socket.remoteAddress,
        port: req.socket.localPort
      });

      const value = await endpoint.filter!({ req: httpReq });

      res.statusCode = value.statusCode ?? 200;
      value.headers.forEach((v, k) => res.setHeader(k, v));
      if (isReadable(value.output)) {
        await pipeline(value.output, res);
      } else {
        res.write(value.output);
        res.end();
      }
    };
  }

  async listen(): Promise<WebServerHandle> {
    const core = this.config.ssl?.active ?
      https.createServer(this.config.ssl.keys, this.handler) :
      http.createServer(this.handler);

    const { reject, resolve, promise } = Promise.withResolvers<void>();
    const server = core.listen(this.config.port, this.config.bindAddress)
      .on('error', reject)
      .on('listening', resolve);
    await promise;
    server.off('error', reject);

    return {
      port: this.config.port,
      close: server.close.bind(server),
      on: server.on.bind(server)
    };
  }
}