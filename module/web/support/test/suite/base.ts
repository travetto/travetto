import { RootRegistry } from '@travetto/registry';
import { castTo, Class } from '@travetto/runtime';
import { AfterAll, BeforeAll } from '@travetto/test';
import { DependencyRegistry, Injectable } from '@travetto/di';
import { ConfigSource, ConfigSpec } from '@travetto/config';
import { CliUtil, RunResponse } from '@travetto/cli';

import { WebDispatcher } from '../../../src/types/dispatch.ts';
import { WebRequest, WebRequestContext } from '../../../src/types/request.ts';
import { WebResponse } from '../../../src/types/response.ts';
import { WebMessageInit } from '../../../src/types/message.ts';

@Injectable()
export class WebTestConfig implements ConfigSource {
  async get(): Promise<ConfigSpec> {
    return {
      data: {
        web: {
          cookie: { secure: false },
          trustProxy: { ips: ['*'] },
          http: {
            ssl: { active: false },
            port: -1,
          }
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

  #appHandle?: RunResponse;
  #dispatcher: WebDispatcher;

  appType?: Class<{ run: () => (RunResponse | Promise<RunResponse>) }>;
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
    if (this.#appHandle) {
      await CliUtil.listenForResponse(this.#appHandle);
      this.#appHandle = undefined;
    }
  }

  async request<T>(cfg: WebMessageInit<unknown, WebRequestContext>, throwOnError: boolean = true): Promise<WebResponse<T>> {
    const response = await this.#dispatcher.dispatch({ request: new WebRequest(cfg) });
    if (throwOnError && response.context.httpStatusCode && response.context.httpStatusCode >= 400) { throw response.body; }
    return castTo(response);
  }
}