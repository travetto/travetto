import timers from 'node:timers/promises';

import { DependencyRegistry } from '@travetto/di';
import { type Request, RestCookieConfig, RestConfig, RestSslConfig, RestApplication } from '@travetto/rest';

import { RestServerSupport, MakeRequestConfig, headerToShape } from './base';

/**
 * Support for invoking http requests against the server
 */
export class CoreRestServerSupport implements RestServerSupport {

  #app: RestApplication;
  #port: number;

  constructor(port: number) {
    this.#port = port;
  }

  get port(): number {
    return this.#port;
  }

  async init(qualifier?: symbol) {
    Object.assign(
      await DependencyRegistry.getInstance(RestCookieConfig),
      { active: true, secure: false, signed: false }
    );

    const config = await DependencyRegistry.getInstance(RestConfig);
    config.port = this.#port;
    config.ssl = RestSslConfig.from({ active: false }); // Update config object

    this.#app = await DependencyRegistry.getInstance(RestApplication, qualifier);
    const handle = await this.#app.run();

    const start = Date.now();

    while ((Date.now() - start) < 5000) {
      try {
        await fetch(this.url);
        break; // We good
      } catch {
        await timers.setTimeout(100);
      }
    }

    return handle;
  }

  async execute(method: Request['method'], path: string, { query, headers, body }: MakeRequestConfig<Buffer> = {}) {

    let q = '';
    if (query && Object.keys(query).length) {
      const pairs = Object.entries(query).map(([k, v]) => [k, v === null || v === undefined ? '' : `${v}`] as [string, string]);
      q = `?${new URLSearchParams(pairs).toString()}`;
    }
    const res = await fetch(`${this.url}${path}${q}`, {
      method,
      headers: headerToShape.single(headers),
      body
    });

    return { status: res.status, body: Buffer.from(await res.text()), headers: Object.fromEntries(res.headers.entries()) };
  }

  get url() {
    return `http://localhost:${this.#port}`;
  }
}