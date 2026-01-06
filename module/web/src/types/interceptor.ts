import type { Class } from '@travetto/runtime';

import type { EndpointConfig } from '../registry/types.ts';
import type { WebChainedContext } from './filter.ts';
import type { WebResponse } from './response.ts';
import type { WebInterceptorCategory } from './core.ts';

export type WebInterceptorContext<C = unknown> = { endpoint: EndpointConfig, config: C };

/**
 * Web interceptor structure
 *
 * @concrete
 */
export interface WebInterceptor<C = unknown> {

  /**
   * The category an interceptor belongs to
   */
  category: WebInterceptorCategory;

  /**
   * Config for interceptor
   */
  config?: Readonly<C>;

  /**
   * This interceptor must run after these
   */
  dependsOn?: Class<WebInterceptor>[];

  /**
   * This interceptor must run before these
   */
  runsBefore?: Class<WebInterceptor>[];

  /**
   * Determines the current endpoint is applicable for the interceptor
   * @param endpoint The endpoint to check
   * @param config The root configuration
   */
  applies?(context: WebInterceptorContext<C>): boolean;

  /**
   * Finalize config before use
   */
  finalizeConfig?(context: WebInterceptorContext<C>, inputs: Partial<C>[]): C;

  /**
   * Process the request
   * @param {WebChainedContext} context The context of to process
   */
  filter(context: WebChainedContext<C>): Promise<WebResponse>;
}