import { Registry } from '@travetto/registry';
import { castTo, type Class } from '@travetto/runtime';
import { AfterAll, BeforeAll } from '@travetto/test';
import { DependencyRegistryIndex, Injectable } from '@travetto/di';
import type { ConfigSource, ConfigPayload } from '@travetto/config';
import { Schema } from '@travetto/schema';

import type { WebDispatcher } from '../../../src/types/dispatch.ts';
import { WebRequest, type WebRequestContext } from '../../../src/types/request.ts';
import type { WebResponse } from '../../../src/types/response.ts';
import type { WebMessageInit } from '../../../src/types/message.ts';

@Injectable()
export class WebTestConfig implements ConfigSource {
  async get(): Promise<ConfigPayload> {
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
@Schema()
export abstract class BaseWebSuite {

  #cleanup?: () => void;
  #dispatcher: WebDispatcher;

  serve?(): Promise<() => void>;
  dispatcherType: Class<WebDispatcher>;

  @BeforeAll()
  async initServer(): Promise<void> {
    await Registry.init();
    this.#cleanup = await this.serve?.();
    this.#dispatcher = await DependencyRegistryIndex.getInstance(this.dispatcherType);
  }

  @AfterAll()
  async destroySever(): Promise<void> {
    this.#cleanup?.();
    this.#cleanup = undefined;
  }

  async request<T>(cfg: WebMessageInit<unknown, WebRequestContext>, throwOnError: boolean = true): Promise<WebResponse<T>> {
    const response = await this.#dispatcher.dispatch({ request: new WebRequest(cfg) });
    if (throwOnError && response.context.httpStatusCode && response.context.httpStatusCode >= 400) { throw response.body; }
    return castTo(response);
  }
}