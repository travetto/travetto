import https from 'node:https';
// eslint-disable-next-line @typescript-eslint/naming-convention
import Router from 'router';

import { Inject, Injectable } from '@travetto/di';
import { WebConfig, WebServer, WebServerHandle, EndpointConfig } from '@travetto/web';
import { castTo, Util } from '@travetto/runtime';

import { NodeWebServerUtil } from './util.ts';
import { IncomingMessage, ServerResponse } from 'node:http';

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

  updateGlobalOnChange = true;

  @Inject()
  config: WebConfig;

  async init(): Promise<NodeWebApplication> {
    let server: https.Server;
    const router = Router();
    const routed = (req: IncomingMessage, res: ServerResponse): void => { router(req, res, () => { }); };

    if (this.config.ssl?.active) {
      server = https.createServer((await this.config.ssl?.getKeys())!, routed);
    } else {
      server = https.createServer(routed);
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
    const router = Router({});
    castTo<{ key?: string | symbol }>(router).key = key;

    for (const endpoint of endpoints) {
      const finalPath = endpoint.path === '/*all' ? '*all' :
        endpoint.path.replace(/[*][^/]*/g, p => p.length > 1 ? p : '*wildcard');

      router[endpoint.method](finalPath, async (req, res) => {
        await endpoint.handlerFinalized!(...NodeWebServerUtil.convert(req, res));
      });
    }

    this.raw.router.use(path, router);
  }

  async listen(): Promise<WebServerHandle> {
    this.listening = true;
    console.info('Listening', { port: this.config.port });

    const { reject, resolve, promise } = Util.resolvablePromise();
    this.raw.listen(this.config.port, this.config.hostname, undefined, resolve);
    this.raw.on('error', reject);
    await promise;
    this.raw.off('error', reject);
    return this.raw;
  }
}