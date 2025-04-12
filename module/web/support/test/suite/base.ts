import { RootRegistry } from '@travetto/registry';
import { castTo, Class } from '@travetto/runtime';
import { AfterAll, BeforeAll } from '@travetto/test';
import { DependencyRegistry, Injectable } from '@travetto/di';
import { ConfigSource, ConfigSpec } from '@travetto/config';

import { WebApplication, WebApplicationHandle } from '../../../src/types/application.ts';
import { WebDispatcher } from '../../../src/types.ts';
import { WebRequest, WebRequestInit } from '../../../src/types/request.ts';
import { WebResponse } from '../../../src/types/response.ts';

import { WebTestDispatchUtil } from '../dispatch-util.ts';

@Injectable()
export class WebTestConfig implements ConfigSource {
  async get(): Promise<ConfigSpec> {
    return {
      data: {
        web: {
          cookie: { active: true, secure: false },
          ssl: { active: false },
          trustProxy: ['*'], port: -1
        }
      },
      source: 'custom://test/web',
      priority: 10000
    };
  }
}

/**
 * Base Web Suite
 */
export abstract class BaseWebSuite {

  #appHandle?: WebApplicationHandle;
  #dispatcher: WebDispatcher;

  appType?: Class<WebApplication>;
  dispatcherType: Class<WebDispatcher>;

  @BeforeAll()
  async initServer(): Promise<void> {
    await RootRegistry.init();
    if (this.appType) {
      this.#appHandle = await DependencyRegistry.getInstance(this.appType).then(v => v.run());
    }
    this.#dispatcher = await DependencyRegistry.getInstance(this.dispatcherType);
  }

  @AfterAll()
  async destroySever(): Promise<void> {
    await this.#appHandle?.close?.();
    this.#appHandle = undefined;
  }

  async request<T>(cfg: WebRequestInit, throwOnError: boolean = true): Promise<WebResponse<T>> {
    const req = await WebTestDispatchUtil.applyRequestBody(new WebRequest(cfg));
    const res = await this.#dispatcher.dispatch({ req });
    if (throwOnError && res.statusCode && res.statusCode >= 400) { throw res.body; }
    return castTo(res);
  }
}