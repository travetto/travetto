import { ConfigurationService } from '@travetto/config';
import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { StandardWebRouter } from '@travetto/web';

import { WebHttpConfig } from './config.ts';
import { WebHttpUtil } from './http.ts';
import { WebHttpServer, WebHttpServerHandle } from './types.ts';

/**
 * The default node http server
 */
@Injectable({ target: DefaultWebServer })
export class DefaultWebServer implements WebHttpServer {

  @Inject()
  serverConfig: WebHttpConfig;

  @Inject()
  router: StandardWebRouter;

  async serve(): Promise<WebHttpServerHandle> {
    await DependencyRegistry.getInstance(ConfigurationService).then(v => v.initBanner());
    return WebHttpUtil.startHttpServer({ ...this.serverConfig, dispatcher: this.router, });
  }
}