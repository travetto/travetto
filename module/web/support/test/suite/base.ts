import zlib from 'node:zlib';
import { buffer as toBuffer } from 'node:stream/consumers';
import { Readable } from 'node:stream';

import { RootRegistry } from '@travetto/registry';
import { AppError, castTo, Class } from '@travetto/runtime';
import { AfterAll, BeforeAll } from '@travetto/test';
import { BindUtil } from '@travetto/schema';
import { DependencyRegistry } from '@travetto/di';

import { WebApplication, WebServerHandle } from '../../../src/types/application.ts';
import { WebRequest, WebRequestInit } from '../../../src/types/request.ts';
import { WebResponse } from '../../../src/types/response.ts';
import { WebRouter } from '../../../src/application/router.ts';
import { CookieConfig } from '@travetto/web';

function asBuffer(v: Buffer | Readable): Promise<Buffer> {
  return !Buffer.isBuffer(v) ? toBuffer(v) : Promise.resolve(v);
}

/**
 * Base Web Suite
 */
export abstract class BaseWebSuite {

  #handle?: WebServerHandle;
  #app?: WebApplication;
  #router: WebRouter;

  appType?: Class<WebApplication>;
  routerType: Class<WebRouter>;

  @BeforeAll()
  async initServer(): Promise<void> {
    await RootRegistry.init();
    this.#router = await DependencyRegistry.getInstance(this.routerType);
    if (this.appType) {
      this.#app = await DependencyRegistry.getInstance(this.appType);
      this.#handle = await this.#app.run();
    }

    // Deactivate secure cookies
    Object.assign(
      await DependencyRegistry.getInstance(CookieConfig),
      { active: true, secure: false, signed: false }
    );

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

    const res = await this.#router.execute(req);
    let bufferResult = await asBuffer(res.body);

    if (bufferResult.length) {
      try {
        switch (res.headers.getList('Content-Encoding')?.[0]) {
          case 'gzip': bufferResult = zlib.gunzipSync(bufferResult); break;
          case 'deflate': bufferResult = zlib.inflateSync(bufferResult); break;
          case 'br': bufferResult = zlib.brotliDecompressSync(bufferResult); break;
        }
      } catch { /* Preemptively attempt to decompress */ }
    }

    let result = await this.getOutput(bufferResult);

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