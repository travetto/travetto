import { RootRegistry } from '@travetto/registry';
import { castTo, Class } from '@travetto/runtime';
import { AfterAll, BeforeAll } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';

import { WebApplication, WebApplicationHandle } from '../../../src/types/application.ts';
import { WebDispatcher } from '../../../src/types.ts';
import { WebRequest, WebRequestInit } from '../../../src/types/request.ts';
import { WebResponse } from '../../../src/types/response.ts';
import { CookieConfig } from '../../../src/interceptor/cookies.ts';
import { WebConfig } from '../../../src/config/web.ts';
import { WebTestDispatchUtil } from '../dispatch-util.ts';

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
    const req = await WebTestDispatchUtil.applyRequestBody(new WebRequest(cfg));
    const res = await dispatcher.dispatch({ req });

    if (throwOnError && res.body instanceof Error) {
      throw res.body;
    }

    return castTo(res);
  }
}