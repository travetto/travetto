import router from 'find-my-way';

import { RuntimeError } from '@travetto/runtime';
import { Inject, Injectable } from '@travetto/di';

import type { EndpointConfig } from '../registry/types.ts';

import { WebResponse } from '../types/response.ts';
import { HTTP_METHODS } from '../types/core.ts';
import type { WebFilterContext } from '../types/filter.ts';
import type { WebConfig } from '../config.ts';

import { BaseWebRouter } from './base.ts';

const DEFAULT_HTTP_METHOD = 'POST';

/**
 * The web router
 */
@Injectable()
export class StandardWebRouter extends BaseWebRouter {

  @Inject()
  config: WebConfig;

  #cache = new Map<Function, EndpointConfig>();
  raw = router();

  async register(endpoints: EndpointConfig[]): Promise<void> {
    for (const endpoint of endpoints) {
      const fullPath = endpoint.fullPath.replace(/[*][^*]+/g, '*'); // Flatten wildcards
      const handler = (): void => { };
      this.#cache.set(handler, endpoint);
      this.raw[HTTP_METHODS[endpoint.httpMethod ?? DEFAULT_HTTP_METHOD].lower](fullPath, handler);
    }
  }

  /**
   * Route and execute the request
   */
  async dispatch({ request }: WebFilterContext): Promise<WebResponse> {
    const httpMethod = request.context.httpMethod ?? DEFAULT_HTTP_METHOD;
    const { params, handler } = this.raw.find(httpMethod, request.context.path) ?? {};
    const endpoint = this.#cache.get(handler!);
    if (!endpoint) {
      return new WebResponse({
        body: new RuntimeError(`Unknown endpoint ${httpMethod} ${request.context.path}`, { category: 'notfound' }),
      });
    }
    Object.assign(request.context, { pathParams: params });
    return endpoint.filter!({ request });
  }
}