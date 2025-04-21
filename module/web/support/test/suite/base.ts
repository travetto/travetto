import { RootRegistry } from '@travetto/registry';
import { castTo, Class } from '@travetto/runtime';
import { AfterAll, BeforeAll } from '@travetto/test';
import { DependencyRegistry, Injectable } from '@travetto/di';
import { ConfigSource, ConfigSpec } from '@travetto/config';

import { WebApplication, WebApplicationHandle } from '../../../src/types/application.ts';
import { WebDispatcher } from '../../../src/types.ts';
import { WebRequest, WebRequestContext } from '../../../src/types/request.ts';
import { WebResponse } from '../../../src/types/response.ts';
import { WebMessageInit } from '../../../src/types/message.ts';

import { WebTestDispatchUtil } from '../dispatch-util.ts';

@Injectable()
export class WebTestConfig implements ConfigSource {
  async get(): Promise<ConfigSpec> {
    return {
      data: {
        web: {
          cookie: { secure: false },
          ssl: { active: false },
          trustProxy: { ips: ['*'] },
          port: -1,
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

  async request<T>(cfg: WebMessageInit<unknown, WebRequestContext>, throwOnError: boolean = true): Promise<WebResponse<T>> {
    const request = await WebTestDispatchUtil.applyRequestBody(new WebRequest(cfg));
    const response = await this.#dispatcher.dispatch({ request });
    if (throwOnError && response.context.httpStatusCode && response.context.httpStatusCode >= 400) { throw response.body; }
    return castTo(response);
  }
}