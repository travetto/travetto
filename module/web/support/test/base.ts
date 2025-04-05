import { buffer as toBuffer } from 'node:stream/consumers';
import { Readable } from 'node:stream';

import { RootRegistry } from '@travetto/registry';
import { AppError, castTo, Class, classConstruct } from '@travetto/runtime';
import { AfterAll, BeforeAll } from '@travetto/test';
import { BindUtil } from '@travetto/schema';

import { WebServerHandle } from '../../src/types/server.ts';
import { WebRequest, WebRequestInit } from '../../src/types/request.ts';
import { WebResponse } from '../../src/types/response.ts';

import { WebServerSupport } from './server-support/base.ts';

function asBuffer(v: Buffer | Readable): Promise<Buffer> {
  return !Buffer.isBuffer(v) ? toBuffer(v) : Promise.resolve(v);
}

/**
 * Base Web Suite
 */
export abstract class BaseWebSuite {

  #handle?: WebServerHandle;
  #support: WebServerSupport;

  type: Class<WebServerSupport>;
  qualifier?: symbol;

  @BeforeAll()
  async initServer(): Promise<void> {
    this.#support = classConstruct(this.type);
    await RootRegistry.init();
    this.#handle = await this.#support.init(this.qualifier);
  }

  get port(): number | undefined {
    return 'port' in this.#support && typeof this.#support['port'] === 'number' ? this.#support.port : undefined;
  }

  async getOutput<T>(t: Buffer): Promise<T | string> {
    try {
      return JSON.parse(t.toString('utf8'));
    } catch {
      return t.toString('utf8');
    }
  }

  @AfterAll()
  async destroySever(): Promise<void> {
    if (this.#handle) {
      await this.#handle.close?.();
      this.#handle = undefined;
    }
  }

  async request<T>(cfg: WebRequest | WebRequestInit, throwOnError: boolean = true): Promise<WebResponse<T>> {

    const req = !(cfg instanceof WebRequest) ? new WebRequest(cfg) : cfg;

    if (req.body) {
      const sample = WebResponse.from(req.body).ensureContentLength().ensureContentType();
      sample.headers.forEach((v, k) => req.headers.set(k, Array.isArray(v) ? v.join(',') : v));
      req.body = await asBuffer(sample.body);
    }

    Object.assign(req, { query: BindUtil.flattenPaths(req.query ?? {}) });

    const res = await this.#support.execute(req);
    let result = await asBuffer(res.body).then(v => this.getOutput(v));

    if (res.statusCode && res.statusCode >= 400) {
      const err = WebResponse.fromCatch(AppError.fromJSON(result) ?? result).source!;
      if (throwOnError) {
        throw err;
      } else {
        result = err;
      }
    }

    res.source = castTo(result);
    return castTo(res);
  }
}