import { buffer as toBuffer } from 'node:stream/consumers';
import { Readable } from 'node:stream';

import { RootRegistry } from '@travetto/registry';
import { AppError, BinaryUtil, castTo, Class } from '@travetto/runtime';
import { AfterAll, BeforeAll } from '@travetto/test';
import { BindUtil } from '@travetto/schema';
import { DependencyRegistry } from '@travetto/di';

import { WebApplication, WebApplicationHandle } from '../../../src/types/application.ts';
import { WebDispatcher } from '../../../src/types.ts';
import { WebRequest, WebRequestInit } from '../../../src/types/request.ts';
import { WebResponse } from '../../../src/types/response.ts';
import { CookieConfig } from '../../../src/interceptor/cookies.ts';
import { WebConfig } from '../../../src/config/web.ts';
import { DecompressInterceptor } from '../../../src/interceptor/decompress.ts';

/**
 * Base Web Suite
 */
export abstract class BaseWebSuite {

  #appHandle?: WebApplicationHandle;

  appType?: Class<WebApplication>;
  dispatcherType: Class<WebDispatcher>;

  @BeforeAll()
  async initServer(): Promise<void> {
    await RootRegistry.init();

    // Deactivate secure cookies
    Object.assign(
      await DependencyRegistry.getInstance(CookieConfig),
      { active: true, secure: false }
    );

    // Deactivate ssl/port
    Object.assign(
      await DependencyRegistry.getInstance(WebConfig),
      { port: -1, ssl: { active: false } }
    );

    if (this.appType) {
      this.#appHandle = await DependencyRegistry.getInstance(this.appType).then(v => v.run());
    }
  }

  @AfterAll()
  async destroySever(): Promise<void> {
    await this.#appHandle?.close?.();
    this.#appHandle = undefined;
  }

  async request<T>(cfg: WebRequest | WebRequestInit, throwOnError: boolean = true): Promise<WebResponse<T>> {

    const dispatcher = await DependencyRegistry.getInstance(this.dispatcherType);

    const webReq = !(cfg instanceof WebRequest) ? new WebRequest(cfg) : cfg;

    if (webReq.body) {
      const sample = new WebResponse({ body: webReq.body }).toBinary();
      sample.headers.forEach((v, k) => webReq.headers.set(k, Array.isArray(v) ? v.join(',') : v));
      webReq.body = WebRequest.markUnprocessed(await BinaryUtil.toBuffer(sample.body));
    }

    Object.assign(webReq, { query: BindUtil.flattenPaths(webReq.query ?? {}) });

    const webRes = await dispatcher.dispatch({ req: webReq });
    let result = webRes.body;
    if (Buffer.isBuffer(result) || BinaryUtil.isReadable(result)) {
      let bufferResult = await BinaryUtil.toBuffer(webRes.toBinary().body);

      if (bufferResult.length) {
        try {
          bufferResult = await toBuffer(DecompressInterceptor.decompress(
            webRes.headers,
            Readable.from(bufferResult),
            { applies: true, supportedEncodings: ['br', 'deflate', 'gzip', 'identity'] }
          ));
        } catch { }
      }

      result = bufferResult.toString('utf8');
      try { result = JSON.parse(castTo(result)); } catch { }
    }

    if (webRes.statusCode && webRes.statusCode >= 400) {
      result = WebResponse.fromCatch(AppError.fromJSON(result) ?? result).body;
    }

    if (throwOnError && result instanceof Error) {
      throw result;
    }

    webRes.body = result;
    return castTo(webRes);
  }
}