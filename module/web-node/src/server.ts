import { IncomingMessage, ServerResponse } from 'node:http';

import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { StandardWebRouter } from '@travetto/web';
import { ConfigurationService } from '@travetto/config';
import { WebHttpUtil, WebHttpConfig, WebHttpServer, WebHttpServerHandle } from '@travetto/web-http-server';

import { NodeWebUtil } from './util.ts';

/**
 * A node http server
 */
@Injectable()
export class NodeWebServer implements WebHttpServer {

  @Inject()
  serverConfig: WebHttpConfig;

  @Inject()
  router: StandardWebRouter;

  async handler(nodeReq: IncomingMessage, nodeRes: ServerResponse): Promise<void> {
    const request = NodeWebUtil.toWebRequest(nodeReq);
    const response = await this.router.dispatch({ request });
    await NodeWebUtil.respondToServerResponse(response, nodeRes);
  }

  async serve(): Promise<WebHttpServerHandle> {
    await DependencyRegistry.getInstance(ConfigurationService).then(v => v.initBanner());

    const handle = await WebHttpUtil.startHttpServer({
      ...this.serverConfig,
      handler: (req, res) => this.handler(req, res)
    });

    console.log('Listening', { port: this.serverConfig.port });

    return handle;
  }
}