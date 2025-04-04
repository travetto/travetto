import https from 'node:https';
import http from 'node:http';
// eslint-disable-next-line @typescript-eslint/naming-convention
import type Router from 'find-my-way';

import { Inject, Injectable } from '@travetto/di';
import { WebConfig, WebServer, WebServerHandle, EndpointConfig, HTTP_METHODS } from '@travetto/web';
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
    // eslint-disable-next-line no-shadow
    const Router = (await import('find-my-way')).default;
    const router = Router({ querystringParser: (await import('qs')).parse });
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

  async unregisterEndpoints(key: string | symbol): Promise<void> {
    // const layers = this.raw.router.stack;
    // const pos = layers.findIndex(x => castTo<Keyed>(x.handle).key === key);
    // if (pos >= 0) {
    //   layers.splice(pos, 1);
    // }
  }

  async registerEndpoints(key: string | symbol, path: string, endpoints: EndpointConfig[]): Promise<void> {
    // castTo<{ key?: string | symbol }>(router).key = key;

    for (const endpoint of endpoints) {
      const fullPath = endpoint.fullPath.replace(/[*][^*]+/g, '*'); // Flatten wildcards

      this.raw.router[HTTP_METHODS[endpoint.method].lower](fullPath, async (req, res, params) => {
        await endpoint.filter!({ req: NodeWebServerUtil.getRequest(castTo(req), castTo(res), castTo(params)) });
      });
    }
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