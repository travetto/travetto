import timers from 'node:timers/promises';

import { DependencyRegistry } from '@travetto/di';
import { type HttpRequest, CookieConfig, WebConfig, WebSslConfig, WebApplication, HttpHeaders } from '@travetto/web';

import { WebServerSupport, MakeRequestConfig, headerToShape } from './base.ts';

/**
 * Support for invoking http requests against the server
 */
export class CoreWebServerSupport implements WebServerSupport {

  #app: WebApplication;
  #port: number;

  constructor(port: number) {
    this.#port = port;
  }

  get port(): number {
    return this.#port;
  }

  async init(qualifier?: symbol) {
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

  async execute(method: HttpRequest['method'], path: string, { query, headers, body }: MakeRequestConfig<Buffer> = {}) {

    let q = '';
    if (query && Object.keys(query).length) {
      const pairs = Object.entries(query).map<[string, string]>(([k, v]) => [k, v === null || v === undefined ? '' : `${v}`]);
      q = `?${new URLSearchParams(pairs).toString()}`;
    }

    const ctrl = new AbortController();

    const res = await fetch(`${this.url}${path}${q}`, {
      method,
      headers: headerToShape.single(headers),
      body,
      signal: ctrl.signal
    });

    const out = { status: res.status, body: Buffer.from(await res.arrayBuffer()), headers: new HttpHeaders(Object.fromEntries(res.headers.entries())) };
    ctrl.abort();
    return out;
  }

  get url() {
    return `http://localhost:${this.#port}`;
  }
}