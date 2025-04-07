import zlib from 'node:zlib';
import { buffer as toBuffer } from 'node:stream/consumers';
import { Readable } from 'node:stream';

import { RootRegistry } from '@travetto/registry';
import { AppError, castTo, Class } from '@travetto/runtime';
import { AfterAll, BeforeAll } from '@travetto/test';
import { BindUtil } from '@travetto/schema';
import { DependencyRegistry } from '@travetto/di';

import { WebApplication, WebDispatcher, WebApplicationHandle } from '../../../src/types/application.ts';
import { WebRequest, WebRequestInit } from '../../../src/types/request.ts';
import { WebResponse } from '../../../src/types/response.ts';
import { CookieConfig } from '../../../src/interceptor/cookies.ts';
import { WebConfig } from '../../../src/config/web.ts';

function asBuffer(v: Buffer | Readable): Promise<Buffer> {
  return !Buffer.isBuffer(v) ? toBuffer(v) : Promise.resolve(v);
}

/**
 * Base Web Suite
 */
export abstract class BaseWebSuite {

  #handle?: WebApplicationHandle;
  #app?: WebApplication;

  appType?: Class<WebApplication>;
  dispatcherType: Class<WebDispatcher>;

  @BeforeAll()
  async initServer(): Promise<void> {
    await RootRegistry.init();

    // Deactivate secure cookies
    Object.assign(
      await DependencyRegistry.getInstance(CookieConfig),
      { active: true, secure: false, signed: false }
    );

    // Deactivate ssl/port
    Object.assign(
      await DependencyRegistry.getInstance(WebConfig),
      { port: -1, ssl: { active: false } }
    );

    if (this.appType) {
      this.#app = await DependencyRegistry.getInstance(this.appType);
      this.#handle = await this.#app.run();
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

    const dispatcher = await DependencyRegistry.getInstance(this.dispatcherType);

    const webReq = !(cfg instanceof WebRequest) ? new WebRequest(cfg) : cfg;

    if (webReq.body) {
      const sample = WebResponse.from(webReq.body).ensureContentLength().ensureContentType();
      sample.headers.forEach((v, k) => webReq.headers.set(k, Array.isArray(v) ? v.join(',') : v));
      webReq.body = await asBuffer(sample.body);
    }

    Object.assign(webReq, { query: BindUtil.flattenPaths(webReq.query ?? {}) });

    const webRes = await dispatcher.dispatch({ req: webReq });
    let bufferResult = await asBuffer(webRes.body);

    if (bufferResult.length) {
      try {
        switch (webRes.headers.getList('Content-Encoding')?.[0]) {
          case 'gzip': bufferResult = zlib.gunzipSync(bufferResult); break;
          case 'deflate': bufferResult = zlib.inflateSync(bufferResult); break;
          case 'br': bufferResult = zlib.brotliDecompressSync(bufferResult); break;
        }
      } catch { /* Preemptively attempt to decompress */ }
    }

    let result: unknown = bufferResult.toString('utf8');
    try { result = JSON.parse(castTo(result)); } catch { }

    if (webRes.statusCode && webRes.statusCode >= 400) {
      const err = WebResponse.fromCatch(AppError.fromJSON(result) ?? result).source!;
      if (throwOnError) {
        throw err;
      } else {
        result = err;
      }
    }

    webRes.source = castTo(result);
    return castTo(webRes);
  }
}