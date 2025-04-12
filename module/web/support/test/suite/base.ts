import { RootRegistry } from '@travetto/registry';
import { AppError, castTo, Class } from '@travetto/runtime';
import { AfterAll, BeforeAll } from '@travetto/test';
import { BindUtil } from '@travetto/schema';
import { DependencyRegistry } from '@travetto/di';

import { WebApplication, WebApplicationHandle } from '../../../src/types/application.ts';
import { WebDispatcher } from '../../../src/types.ts';
import { WebRequest, WebRequestInit } from '../../../src/types/request.ts';
import { WebResponse } from '../../../src/types/response.ts';
import { CookieConfig } from '../../../src/interceptor/cookies.ts';
import { WebConfig } from '../../../src/config/web.ts';
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
      { port: -1, ssl: { active: false }, trustProxy: true }
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

    const query = BindUtil.flattenPaths(cfg.query ?? {});
    const webReq = new WebRequest<unknown>({ ...cfg, query });

    if (webReq.body) {
      const sample = new WebResponse(webReq).toBinary();
      sample.headers.forEach((v, k) => webReq.headers.set(k, Array.isArray(v) ? v.join(',') : v));
      webReq.body = WebRequest.markUnprocessed(await WebBodyUtil.toBuffer(sample.body));
    }

    const webRes = await dispatcher.dispatch({ req: webReq });
    let result = webRes.body;

    const text = Buffer.isBuffer(result) ? result.toString('utf8') : (typeof result === 'string' ? result : undefined);
    console.log('Got the response', webRes.headers.getContentType(), text);

    if (text) {
      switch (webRes.headers.get('Content-Type')) {
        case 'application/json': {
          try { result = JSON.parse(castTo(text)); } catch { }
          break;
        }
        case 'text/plain': result = text; break;
      }
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