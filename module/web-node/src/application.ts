import http, { IncomingMessage, ServerResponse } from 'node:http';
import https from 'node:https';

import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { WebConfig, WebApplication, WebApplicationHandle, WebDispatcher, NetUtil } from '@travetto/web';
import { ConfigurationService } from '@travetto/config';

import { NodeWebUtil } from './util.ts';

/**
 * An express http server
 */
@Injectable()
export class NodeWebApplication implements WebApplication {

  @Inject()
  config: WebConfig;

  @Inject()
  router: WebDispatcher;

  async handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const webReq = NodeWebUtil.toWebRequest(req);
    const webRes = await this.router.dispatch({ req: webReq });
    await NodeWebUtil.respondToServerResponse(webRes, res);
  }

  async run(): Promise<WebApplicationHandle> {
    const core = this.config.ssl?.active ?
      https.createServer(this.config.ssl.keys!) :
      http.createServer();

    const { reject, resolve, promise } = Promise.withResolvers<void>();

    if (this.config.port < 0) {
      this.config.port = await NetUtil.getFreePort();
    }

    await DependencyRegistry.getInstance(ConfigurationService).then(v => v.initBanner());

    const server = core.listen(this.config.port, this.config.bindAddress)
      .on('error', reject)
      .on('listening', resolve)
      .on('request', this.handler.bind(this));
    await promise;
    server.off('error', reject);

    console.log('Listening', { port: this.config.port });

    return {
      close: server.close.bind(server),
      on: server.on.bind(server)
    };
  }
}