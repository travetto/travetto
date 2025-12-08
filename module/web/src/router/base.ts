import { Class, toConcrete } from '@travetto/runtime';
import { DependencyRegistryIndex, Injectable } from '@travetto/di';
import { ControllerRegistryIndex } from '@travetto/web';
import { Registry } from '@travetto/registry';

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

  #cleanup = new Map<Class, Function>();
  #interceptors: WebInterceptor[];

  async #register(cls: Class): Promise<void> {
    const config = ControllerRegistryIndex.getConfig(cls);

    let endpoints = await EndpointUtil.getBoundEndpoints(cls);
    endpoints = EndpointUtil.orderEndpoints(endpoints);

    for (const endpoint of endpoints) {
      endpoint.filter = EndpointUtil.createEndpointHandler(this.#interceptors, endpoint, config);
    }

    const fn = await this.register(endpoints, config);
    this.#cleanup.set(cls, fn);
  };

  /**
   * Initialize router, encapsulating common patterns for standard router setup
   */
  async postConstruct(): Promise<void> {

    this.#interceptors = await DependencyRegistryIndex.getInstances(toConcrete<WebInterceptor>());
    this.#interceptors = EndpointUtil.orderInterceptors(this.#interceptors);
    const names = this.#interceptors.map(interceptor => interceptor.constructor.name);
    console.debug('Sorting interceptors', { count: names.length, names });

    // Register all active
    for (const cls of ControllerRegistryIndex.getClasses()) {
      await this.#register(cls);
    }

    // Listen for updates
    Registry.onClassChange(ControllerRegistryIndex, {
      onCreate: cls => this.#register(cls),
      onDelete: cls => {
        this.#cleanup.get(cls)?.();
        this.#cleanup.delete(cls);
      }
    });
  }

  abstract register(endpoints: EndpointConfig[], controller: ControllerConfig): Promise<() => void>;
  abstract dispatch(ctx: WebFilterContext): Promise<WebResponse>;
}