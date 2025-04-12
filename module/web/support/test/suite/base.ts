import { RootRegistry } from '@travetto/registry';
import { Class } from '@travetto/runtime';
import { AfterAll, BeforeAll } from '@travetto/test';
import { ConfigSource, ConfigSpec } from '@travetto/config';
import { DependencyRegistry } from '@travetto/di';

import { WebApplication, WebApplicationHandle } from '../../../src/types/application.ts';
import { WebDispatcher } from '../../../src/types.ts';
import { WebRequest, WebRequestInit } from '../../../src/types/request.ts';
import { WebResponse } from '../../../src/types/response.ts';
import { WebTestDispatchUtil } from '../dispatch-util.ts';

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
    DependencyRegistry.registerClass(
      class implements ConfigSource {
        async get(): Promise<ConfigSpec> {
          return {
            data: {
              web: {
                cookie: { active: true, secure: false },
                ssl: { active: false },
                port: -1, trustProxy: ['*']
              }
            },
            source: 'custom://test/override',
            priority: 2000
          };
        }
      }
    );

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
    return WebTestDispatchUtil.returnResponse(res, throwOnError);
  }
}