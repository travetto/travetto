import { Inject, Injectable } from '@travetto/di';
import type { StandardWebRouter } from '@travetto/web';
import type { ConfigurationService } from '@travetto/config';

import type { WebHttpConfig } from './config.ts';
import { WebHttpUtil } from './http.ts';
import type { WebHttpServer, WebServerHandle } from './types.ts';

/**
 * A node http server
 */
@Injectable()
export class NodeWebHttpServer implements WebHttpServer {

  @Inject()
  serverConfig: WebHttpConfig;

  @Inject()
  router: StandardWebRouter;

  @Inject()
  configService: ConfigurationService;

  async serve(): Promise<WebServerHandle> {
    const handle = await WebHttpUtil.startHttpServer({ ...this.serverConfig, dispatcher: this.router, });
    console.log('Initialized', await this.configService.initBanner());
    console.log('Listening', { port: this.serverConfig.port });
    return handle;
  }
}