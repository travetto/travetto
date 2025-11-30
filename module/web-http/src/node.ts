import { Inject, Injectable } from '@travetto/di';
import { StandardWebRouter } from '@travetto/web';
import { ConfigurationService } from '@travetto/config';

import { WebHttpConfig } from './config';
import { WebHttpUtil } from './http';
import { WebHttpServer, WebServerHandle } from './types';

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