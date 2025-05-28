import { Inject, Injectable } from '@travetto/di';
import { StandardWebRouter } from '@travetto/web';
import { ConfigurationService } from '@travetto/config';
import { WebHttpUtil, WebHttpConfig, WebHttpServer, WebServerHandle } from '@travetto/web-http-server';

/**
 * A node http server
 */
@Injectable()
export class NodeWebServer implements WebHttpServer {

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