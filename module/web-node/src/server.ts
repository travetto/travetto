import https from 'node:https';
import http from 'node:http';
// eslint-disable-next-line @typescript-eslint/naming-convention
import type Router from 'find-my-way';

import { Inject, Injectable } from '@travetto/di';
import { WebConfig, WebServer, WebServerHandle, EndpointConfig, HTTP_METHODS, HttpRequest, HttpMethod } from '@travetto/web';
import { castTo } from '@travetto/runtime';

import { NodeWebServerUtil } from './util.ts';

interface NodeWebApplication extends https.Server {
  router: ReturnType<typeof Router>;
};

/**
 * An express http server
 */
@Injectable()
export class NodeWebServer implements WebServer<NodeWebApplication> {

  raw: NodeWebApplication;

  listening: boolean;

  @Inject()
  config: WebConfig;

  async init(): Promise<NodeWebApplication> {
    let server: https.Server | http.Server;
    // eslint-disable-next-line no-shadow
    const Router = (await import('find-my-way')).default;
    const router = Router();
    const routed = (req: http.IncomingMessage, res: http.ServerResponse): void => {
      Object.assign(req, { secure: this.config.ssl?.active });
      router.lookup(req, res, () => { });
    };

    if (this.config.ssl?.active) {
      server = https.createServer({ ...(await this.config.ssl?.getKeys())! }, routed);
    } else {
      server = http.createServer({}, routed);
    }
    const app = castTo<NodeWebApplication>(server);
    app.router = router;
    return this.raw = app;
  }

  async registerEndpoints(endpoints: EndpointConfig[]) {
    const toClean: [HttpMethod, string][] = [];
    for (const endpoint of endpoints) {
      const fullPath = endpoint.fullPath.replace(/[*][^*]+/g, '*'); // Flatten wildcards

      this.raw.router[HTTP_METHODS[endpoint.method].lower](fullPath, async (req, res, params) => {
        castTo<{ params?: HttpRequest['params'] }>(req).params = castTo(params);
        await endpoint.filter!({ req: NodeWebServerUtil.getRequest(castTo(req), castTo(res)) });
      });
      toClean.push([endpoint.method, fullPath]);
    }

    return async (): Promise<void> => {
      for (const [method, path] of toClean) {
        this.raw.router.off(method, path);
      }
    };
  }

  async listen(): Promise<WebServerHandle> {
    const { reject, resolve, promise } = Promise.withResolvers<void>();

    this.listening = true;

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