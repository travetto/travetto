import { IncomingMessage, ServerResponse } from 'node:http';

import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { WebConfig, WebApplication, WebApplicationHandle, NetUtil, StandardWebRouter } from '@travetto/web';
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
  router: StandardWebRouter;

  async handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const webReq = NodeWebUtil.toWebRequest(req).secure(this.config.trustProxy);
    const webRes = await this.router.dispatch({ req: webReq });
    await NodeWebUtil.respondToServerResponse(webRes, res);
  }

  async run(): Promise<WebApplicationHandle> {
    if (this.config.port < 0) {
      this.config.port = await NetUtil.getFreePort();
    }

    await DependencyRegistry.getInstance(ConfigurationService).then(v => v.initBanner());

    const server = await NetUtil.startHttpServer({
      port: this.config.port,
      bindAddress: this.config.bindAddress,
      sslKeys: this.config.ssl?.active ? this.config.ssl.keys : undefined,
      handler: (req, res) => this.handler(req, res)
    });

    console.log('Listening', { port: this.config.port });

    return server;
  }
}