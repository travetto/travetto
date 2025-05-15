import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { StandardWebRouter } from '@travetto/web';
import { ConfigurationService } from '@travetto/config';
import { WebHttpUtil, WebHttpConfig, WebHttpServer, WebHttpServerHandle } from '@travetto/web-http-server';

/**
 * A node http server
 */
@Injectable()
export class NodeWebServer implements WebHttpServer {

  @Inject()
  serverConfig: WebHttpConfig;

  @Inject()
  router: StandardWebRouter;

  async serve(): Promise<WebHttpServerHandle> {
    await DependencyRegistry.getInstance(ConfigurationService).then(v => v.initBanner());
    const handle = await WebHttpUtil.startHttpServer({ ...this.serverConfig, dispatcher: this.router, });
    return handle;
  }
}