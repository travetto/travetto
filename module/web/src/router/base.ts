import { Class, toConcrete } from '@travetto/runtime';
import { DependencyRegistryIndex, Injectable } from '@travetto/di';
import { ControllerRegistryIndex } from '@travetto/web';
import { RegistryV2 } from '@travetto/registry';

import { ControllerConfig, EndpointConfig } from '../registry/types.ts';
import type { WebRouter } from '../types/dispatch.ts';
import { WebInterceptor } from '../types/interceptor.ts';
import { WebResponse } from '../types/response.ts';
import type { WebFilterContext } from '../types/filter.ts';

import { EndpointUtil } from '../util/endpoint.ts';

/**
 * Supports the base pattern for the most common web router implementations
 */
@Injectable()
export abstract class BaseWebRouter implements WebRouter {

  #cleanup = new Map<string, Function>();
  #interceptors: WebInterceptor[];

  async #register(c: Class): Promise<void> {
    const config = ControllerRegistryIndex.getConfig(c);

    let endpoints = await EndpointUtil.getBoundEndpoints(c);
    endpoints = EndpointUtil.orderEndpoints(endpoints);

    for (const ep of endpoints) {
      ep.filter = EndpointUtil.createEndpointHandler(this.#interceptors, ep, config);
    }

    console.debug('Registering Controller Instance', { id: config.class.Ⲑid, path: config.basePath, endpointCount: endpoints.length });
    const fn = await this.register(endpoints, config);
    this.#cleanup.set(c.Ⲑid, fn);
  };

  /**
   * Initialize router, encapsulating common patterns for standard router setup
   */
  async postConstruct(): Promise<void> {

    this.#interceptors = await DependencyRegistryIndex.getInstances(toConcrete<WebInterceptor>());
    this.#interceptors = EndpointUtil.orderInterceptors(this.#interceptors);
    const names = this.#interceptors.map(x => x.constructor.name);
    console.debug('Sorting interceptors', { count: names.length, names });

    // Register all active
    for (const c of ControllerRegistryIndex.getClasses()) {
      await this.#register(c);
    }

    // Listen for updates
    RegistryV2.onClassChange(async e => {
      const targetCls = ('curr' in e ? e.curr : null) ?? ('prev' in e ? e.prev : null);
      console.debug('Registry event', { type: e.type, target: targetCls?.Ⲑid });

      if ('prev' in e && e.prev) {
        this.#cleanup.get(e.prev.Ⲑid)?.();
        this.#cleanup.delete(e.prev.Ⲑid);
      }
      if ('curr' in e && e.curr) {
        await this.#register(e.curr);
      }
    }, ControllerRegistryIndex);
  }

  abstract register(endpoints: EndpointConfig[], controller: ControllerConfig): Promise<() => void>;
  abstract dispatch(ctx: WebFilterContext): Promise<WebResponse>;
}