import { IncomingMessage, ServerResponse } from 'node:http';

import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { StandardWebRouter } from '@travetto/web';
import { ConfigurationService } from '@travetto/config';
import { WebHttpUtil, WebHttpConfig, WebHttpServer } from '@travetto/web-http-server';
import { RunResponse } from '@travetto/cli';

import { NodeWebUtil } from './util.ts';

/**
 * A node http server
 */
@Injectable()
export class NodeWebApplication implements WebHttpServer {

  @Inject()
  serverConfig: WebHttpConfig;

  @Inject()
  router: StandardWebRouter;

  async handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const webReq = NodeWebUtil.toWebRequest(req);
    const webRes = await this.router.dispatch({ request: webReq });
    await NodeWebUtil.respondToServerResponse(webRes, res);
  }

  async run(): Promise<RunResponse> {
    await DependencyRegistry.getInstance(ConfigurationService).then(v => v.initBanner());

    const server = await WebHttpUtil.startHttpServer({
      ...this.serverConfig,
      handler: (req, res) => this.handler(req, res)
    });

    console.log('Listening', { port: this.serverConfig.port });

    return server;
  }
}