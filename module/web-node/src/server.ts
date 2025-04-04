import https from 'node:https';
import http from 'node:http';

import { Inject, Injectable } from '@travetto/di';
import { WebConfig, WebServer, WebServerHandle, WebRouter } from '@travetto/web';
import { castTo } from '@travetto/runtime';

import { NodeWebServerUtil } from './util.ts';

interface NodeWebApplication extends https.Server { };

/**
 * An express http server
 */
@Injectable()
export class NodeWebServer implements WebServer<NodeWebApplication> {

  raw: NodeWebApplication;

  @Inject()
  config: WebConfig;

  async init(): Promise<NodeWebApplication> {
    let server: https.Server | http.Server;

    if (this.config.ssl?.active) {
      server = https.createServer({ ...(await this.config.ssl?.getKeys())! });
    } else {
      server = http.createServer({});
    }
    const app = castTo<NodeWebApplication>(server);
    return this.raw = app;
  }

  registerRouter(router: WebRouter): void {
    this.raw.addListener('request', (req, res) => {
      const { endpoint, params } = router({ method: castTo((req.method ?? 'GET').toUpperCase()), url: req.url ?? '/', headers: req.headers });
      endpoint.filter!({ req: NodeWebServerUtil.getRequest(req, res, params) });
    });
  }

  async listen(): Promise<WebServerHandle> {
    const { reject, resolve, promise } = Promise.withResolvers<void>();

    const server = this.raw
      .on('listening', resolve)
      .on('error', reject)
      .listen(this.config.port, this.config.hostname);

    await promise;
    server.off('error', reject);
    return {
      port: this.config.port,
      close: server.close.bind(server),
      on: server.on.bind(server)
    };
  }
}