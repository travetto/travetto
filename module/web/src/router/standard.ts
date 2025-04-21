import router from 'find-my-way';

import { AppError } from '@travetto/runtime';
import { Inject, Injectable } from '@travetto/di';

import { EndpointConfig } from '../registry/types.ts';

import { WebResponse } from '../types/response.ts';
import { HTTP_METHODS } from '../types/core.ts';
import { WebFilterContext } from '../types.ts';
import { WebConfig } from '../config/web.ts';

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

  async register(endpoints: EndpointConfig[]): Promise<() => void> {
    for (const ep of endpoints) {
      const fullPath = ep.fullPath.replace(/[*][^*]+/g, '*'); // Flatten wildcards
      const handler = (): void => { };
      this.#cache.set(handler, ep);
      this.raw[HTTP_METHODS[ep.httpMethod ?? DEFAULT_HTTP_METHOD].lower](fullPath, handler);
    }

    return (): void => {
      for (const ep of endpoints ?? []) {
        this.raw.off(ep.httpMethod ?? DEFAULT_HTTP_METHOD, ep.fullPath);
      }
    };
  }

  /**
   * Route and run the request
   */
  dispatch({ request }: WebFilterContext): Promise<WebResponse> {
    const method = request.context.httpMethod ?? DEFAULT_HTTP_METHOD;
    const { params, handler } = this.raw.find(method, request.context.path) ?? {};
    const endpoint = this.#cache.get(handler!);
    if (!endpoint) {
      throw new AppError(`Unknown route ${method} ${request.context.path}`, { category: 'notfound' });
    }
    request.context.pathParams = params;
    return endpoint.filter!({ request });
  }
}