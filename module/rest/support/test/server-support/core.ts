import fetch from 'node-fetch';

import { DependencyRegistry } from '@travetto/di';
import { Util } from '@travetto/base';

import type { RestApplication } from '../../../src/application/rest';
import type { Request } from '../../../src/types';
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

  async init() {
    const rest = await import('../../..');

    Object.assign(
      await DependencyRegistry.getInstance(rest.RestCookieConfig),
      { active: true, secure: false, signed: false }
    );

    const config = await DependencyRegistry.getInstance(rest.RestConfig);
    config.port = this.#port;
    config.ssl.active = false; // Update config object

    this.#app = await DependencyRegistry.getInstance(rest.RestApplication);
    const handle = await this.#app.run();

    const start = Date.now();

    while ((Date.now() - start) < 5000) {
      try {
        await fetch(this.url);
        break; // We good
      } catch {
        await Util.wait(100);
      }
    }

    return handle;
  }

  async execute(method: Request['method'], path: string, { query, headers, body }: MakeRequestConfig<Buffer> = {}) {

    let q = '';
    if (query && Object.keys(query).length) {
      q = `?${new URLSearchParams(query).toString()}`;
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