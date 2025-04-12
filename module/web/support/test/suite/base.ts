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
import { WebBodyUtil } from '../../../src/util/body.ts';

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

  async request<T, B = unknown>(cfg: WebRequestInit<B>, throwOnError: boolean = true): Promise<WebResponse<T>> {

    const dispatcher = await DependencyRegistry.getInstance(this.dispatcherType);

    const webReq = new WebRequest<unknown>({
      ...cfg,
      query: BindUtil.flattenPaths(cfg.query ?? {})
    });

    if (webReq.body) {
      const sample = WebBodyUtil.toBinaryMessage(webReq);
      sample.headers.forEach((v, k) => webReq.headers.set(k, Array.isArray(v) ? v.join(',') : v));
      webReq.body = WebRequest.markUnprocessed(await WebBodyUtil.toBuffer(sample.body!));
    }

    const webRes = await dispatcher.dispatch({ req: webReq });
    let result = webRes.body;
    if (Buffer.isBuffer(result) || BinaryUtil.isReadable(result)) {
      let bufferResult = await WebBodyUtil.toBuffer(webRes.toBinary().body);

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