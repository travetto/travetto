import { IncomingMessage, ServerResponse } from 'node:http';

import { Inject, Injectable } from '@travetto/di';
import { WebConfig, WebServer, WebServerHandle, WebRouter, NetUtil } from '@travetto/web';

import { NodeWebServerUtil } from './util.ts';

interface NodeWebApplication {
  handler?: (req: IncomingMessage, res: ServerResponse) => void;
};

/**
 * An express http server
 */
@Injectable()
export class NodeWebServer implements WebServer<NodeWebApplication> {

  raw: NodeWebApplication;

  @Inject()
  config: WebConfig;

  async init(): Promise<NodeWebApplication> {
    return this.raw = {};
  }

  registerRouter(router: WebRouter): void {
    this.raw.handler = (req, res): void => {
      const { endpoint, params } = router(req);
      endpoint.filter!({ req: NodeWebServerUtil.getRequest(req, res, params) });
    };
  }

  async listen(): Promise<WebServerHandle> {
    return NetUtil.createHttpServer({
      bindAddress: this.config.bindAddress,
      port: this.config.port,
      handler: this.raw.handler,
      sslKeys: await (this.config.ssl?.active ? this.config.ssl.getKeys() : undefined),
    });
  }
}