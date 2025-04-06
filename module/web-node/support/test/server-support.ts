import timers from 'node:timers/promises';

import { DependencyRegistry } from '@travetto/di';
import { type WebRequest, CookieConfig, WebConfig, WebSslConfig, WebApplication, NetUtil, WebResponse } from '@travetto/web';

import { WebServerSupport } from '@travetto/web/support/test/types.ts';

import { NodeWebUtil } from '../../src/util';

/**
 * Support for invoking http requests against the server
 */
export class NodeWebServerSupport implements WebServerSupport {

  #app: WebApplication;
  #port: number;

  constructor(port: number = -1) {
    this.#port = port;
  }

  get port(): number {
    return this.#port;
  }

  async init(qualifier?: symbol) {
    if (this.#port < 0) {
      this.#port = await NetUtil.getFreePort();
    }

    Object.assign(
      await DependencyRegistry.getInstance(CookieConfig),
      { active: true, secure: false, signed: false }
    );

    const config = await DependencyRegistry.getInstance(WebConfig);
    config.port = this.#port;
    config.ssl = WebSslConfig.from({ active: false }); // Update config object

    this.#app = await DependencyRegistry.getInstance(WebApplication, qualifier);
    const handle = await this.#app.run();

    const start = Date.now();

    while ((Date.now() - start) < 5000) {
      try {
        const ctrl = new AbortController();
        await fetch(this.url, { signal: ctrl.signal });
        ctrl.abort();
        break; // We good
      } catch {
        await timers.setTimeout(100);
      }
    }

    return handle;
  }

  async execute(req: WebRequest): Promise<WebResponse> {
    const { path, ...request } = NodeWebUtil.toFetchRequest(req);
    const res = await fetch(`${this.url}${path}`, request);
    return NodeWebUtil.toWebResponse(res);
  }

  get url() {
    return `http://localhost:${this.#port}`;
  }
}