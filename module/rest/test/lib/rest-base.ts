import * as qs from 'querystring';
import * as fetch from 'node-fetch';

import { DependencyRegistry } from '@travetto/di';
import { ApplicationHandle } from '@travetto/app';
import { RootRegistry } from '@travetto/registry';

import { RestCookieConfig } from '../../src/interceptor/cookies';

export abstract class BaseRestTest {

  private server: ApplicationHandle;
  constructor(private port = 3002) { }


  get url() {
    return `http://localhost:${this.port}`;
  }

  async initServer() {
    await RootRegistry.init();

    const { RestServer } = await import('../../src/server/server');

    const c = await DependencyRegistry.getInstance(RestCookieConfig);
    c.active = true;
    c.secure = false;
    c.signed = false;

    const s = await DependencyRegistry.getInstance(RestServer);
    s.config.port = this.port;
    s.config.ssl.active = false;
    this.server = await s.run();

    const start = Date.now();

    while ((Date.now() - start) < 5000) {
      try {
        await fetch(this.url);
        return; // We good
      } catch  {
        await new Promise(res => setTimeout(res, 100));
      }
    }
  }

  async makeRequst(method: 'get' | 'post' | 'patch' | 'put' | 'delete' | 'options', path: string, { query, headers, body }: {
    query?: Record<string, any>;
    body?: Record<string, any>;
    headers?: Record<string, string>;
  } = {}) {
    let q = '';
    if (query && Object.keys(query).length) {
      q = `?${qs.stringify(query)}`;
    }
    return await fetch(`${this.url}/test${path}${q}`, {
      method: method.toUpperCase(),
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  }

  async destroySever() {
    await this.server.close?.();
    delete this.server;
  }
}