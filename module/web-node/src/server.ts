import http, { IncomingMessage, ServerResponse } from 'node:http';
import https from 'node:https';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

import { Inject, Injectable } from '@travetto/di';
import { WebConfig, WebServer, WebServerHandle, WebRouter } from '@travetto/web';
import { hasFunction } from '@travetto/runtime';

import { NodeWebUtil } from './util.ts';

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

      const webReq = NodeWebUtil.toWebRequest(req, params);
      const webRes = await endpoint.filter!({ req: webReq });

      res.statusCode = webRes.statusCode ?? 200;
      webRes.headers.forEach((v, k) => res.setHeader(k, v));
      if (isReadable(webRes.body)) {
        await pipeline(webRes.body, res);
      } else {
        res.write(webRes.body);
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