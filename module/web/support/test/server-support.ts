import { Readable } from 'node:stream';

import { DependencyRegistry, InjectableFactory } from '@travetto/di';

import { WebServerSupport } from './types.ts';
import { WebApplication } from '../../src/application/app.ts';
import { WebRequest } from '../../src/types/request.ts';
import { WebResponse } from '../../src/types/response.ts';
import { WebInternalSymbol } from '../../src/types/core.ts';

/**
 * Support for invoking http requests against the server
 */
export class BasicWebServerSupport implements WebServerSupport {

  @InjectableFactory(WebInternalSymbol)
  static getApp(): WebApplication {
    const app = new WebApplication();
    app.server = {
      init() { },
      listen() { return { on() { }, close() { } }; },
      registerRouter(router) { },
    };
    return app;
  }


  #app: WebApplication;

  async init(qualifier?: symbol) {
    this.#app = await DependencyRegistry.getInstance(WebApplication, qualifier);
    return this.#app.run();
  }

  execute(req: WebRequest): Promise<WebResponse> {
    const { endpoint, params } = this.#app.resolveRoute(req);
    Object.assign(req, { params, remoteIp: '::1' });

    if (req.body && Buffer.isBuffer(req.body)) {
      Object.assign(req, { inputStream: Readable.from(req.body), body: undefined });
    }

    return endpoint.filter!({ req });
  }
}