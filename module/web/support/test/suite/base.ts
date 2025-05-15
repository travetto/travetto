import { RootRegistry } from '@travetto/registry';
import { castTo, Class } from '@travetto/runtime';
import { AfterAll, BeforeAll } from '@travetto/test';
import { DependencyRegistry, Injectable } from '@travetto/di';
import { ConfigSource, ConfigSpec } from '@travetto/config';

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
            tls: false,
            port: -1,
          },
          etag: {
            minimumSize: 1
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

  #cleanup?: () => void;
  #dispatcher: WebDispatcher;

  serve?(): Promise<() => void>;
  dispatcherType: Class<WebDispatcher>;

  @BeforeAll()
  async initServer(): Promise<void> {
    await RootRegistry.init();
    this.#cleanup = await this.serve?.();
    this.#dispatcher = await DependencyRegistry.getInstance(this.dispatcherType);
  }

  @AfterAll()
  async destroySever(): Promise<void> {
    await this.#cleanup?.();
    this.#cleanup = undefined;
  }

  async request<T>(cfg: WebMessageInit<unknown, WebRequestContext>, throwOnError: boolean = true): Promise<WebResponse<T>> {
    const response = await this.#dispatcher.dispatch({ request: new WebRequest(cfg) });
    if (throwOnError && response.context.httpStatusCode && response.context.httpStatusCode >= 400) { throw response.body; }
    return castTo(response);
  }
}