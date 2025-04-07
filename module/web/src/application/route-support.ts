import router from 'find-my-way';

import { AppError, castTo } from '@travetto/runtime';
import { Injectable } from '@travetto/di';

import { HTTP_METHODS, HttpMethod } from '../types/core.ts';
import { WebRouterSupport } from '../types/application.ts';
import { WebResponse } from '../types/response.ts';
import { EndpointConfig } from '../registry/types.ts';
import { WebFilterContext } from '../types.ts';

@Injectable({ primary: true })
export class FindMyWayRouterSupport implements WebRouterSupport {
  raw = router();
  #cache = new Map<Function, EndpointConfig>();

  register(endpoint: EndpointConfig): () => void {
    const fullPath = endpoint.fullPath.replace(/[*][^*]+/g, '*'); // Flatten wildcards
    const handler = (): void => { };
    this.#cache.set(handler, endpoint);
    this.raw[HTTP_METHODS[endpoint.method].lower](fullPath, handler);
    return () => {
      this.raw.off(endpoint.method, fullPath);
      this.#cache.delete(handler);
    };
  }

  dispatch({ req }: WebFilterContext): Promise<WebResponse> {
    const method = castTo<HttpMethod>((req.method ?? 'get').toUpperCase());
    const { params, handler } = this.raw.find(method, req.path ?? '/') ?? {};
    const endpoint = this.#cache.get(handler!);
    if (!endpoint) {
      throw new AppError(`Unknown route ${req.method} ${req.path}`, { category: 'notfound' });
    }
    Object.assign(req, { params });
    return endpoint.filter!({ req });
  }
}