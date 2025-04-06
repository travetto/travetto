import http, { IncomingMessage, ServerResponse } from 'node:http';
import https from 'node:https';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { WebConfig, WebApplication, WebServerHandle, WebRouter, NetUtil } from '@travetto/web';
import { hasFunction } from '@travetto/runtime';
import { ConfigurationService } from '@travetto/config';

import { NodeWebUtil } from './util.ts';

const isReadable = hasFunction<Readable>('pipe');

/**
 * An express http server
 */
@Injectable()
export class NodeWebApplication implements WebApplication {

  @Inject()
  config: WebConfig;

  @Inject()
  router: WebRouter;

  async handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const webReq = NodeWebUtil.toWebRequest(req);
    const webRes = await this.router.execute(webReq);

    res.statusCode = webRes.statusCode ?? 200;
    webRes.headers.forEach((v, k) => res.setHeader(k, v));
    if (isReadable(webRes.body)) {
      await pipeline(webRes.body, res);
    } else {
      res.write(webRes.body);
      res.end();
    }
  }

  async run(): Promise<WebServerHandle> {
    const core = this.config.ssl?.active ?
      https.createServer(this.config.ssl.keys, (req, res) => this.handler(req, res)) :
      http.createServer((req, res) => this.handler(req, res));

    const { reject, resolve, promise } = Promise.withResolvers<void>();

    if (this.config.port < 0) {
      this.config.port = await NetUtil.getFreePort();
    }

    await DependencyRegistry.getInstance(ConfigurationService).then(v => v.initBanner());

    const server = core.listen(this.config.port, this.config.bindAddress)
      .on('error', reject)
      .on('listening', resolve);
    await promise;
    server.off('error', reject);

    return {
      close: server.close.bind(server),
      on: server.on.bind(server)
    };
  }
}