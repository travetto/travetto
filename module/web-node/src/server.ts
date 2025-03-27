import https from 'node:https';
import http from 'node:http';
// eslint-disable-next-line @typescript-eslint/naming-convention
import Router from 'router';

import { Inject, Injectable } from '@travetto/di';
import { WebConfig, WebServer, WebServerHandle, EndpointConfig } from '@travetto/web';
import { castTo } from '@travetto/runtime';

import { NodeWebServerUtil } from './util.ts';

type Keyed = { key?: string | symbol };

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
    const router = new Router({ mergeParams: true });
    const routed = (req: http.IncomingMessage, res: http.ServerResponse): void => {
      Object.assign(req, { secure: this.config.ssl?.active });
      router(req, res, () => { });
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

  async unregisterEndpoints(key: string | symbol): Promise<void> {
    const layers = this.raw.router.stack;
    const pos = layers.findIndex(x => castTo<Keyed>(x.handle).key === key);
    if (pos >= 0) {
      layers.splice(pos, 1);
    }
  }

  async registerEndpoints(key: string | symbol, path: string, endpoints: EndpointConfig[]): Promise<void> {
    const router = new Router({ mergeParams: true });
    castTo<{ key?: string | symbol }>(router).key = key;

    for (const endpoint of endpoints) {
      const finalPath = endpoint.path === '/*all' ? '*all' :
        endpoint.path.replace(/[*][^/]*/g, p => p.length > 1 ? p : '*wildcard');

      router[endpoint.method](finalPath, async (req, res, next) => {
        await endpoint.filter!(NodeWebServerUtil.getContext(req, res));
        next();
      });
    }

    this.raw.router.use(path, router);
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