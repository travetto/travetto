import type { Class } from '@travetto/runtime';

import type { EndpointConfig } from '../registry/types.ts';
import type { WebChainedContext } from '../types.ts';
import { WebResponse } from './response.ts';
import { WebInterceptorCategory } from './core.ts';

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
   */
  applies?(endpoint: EndpointConfig, config: C): boolean;

  /**
   * Finalize config before use
   */
  finalizeConfig?(config: C, inputs: Partial<C>[]): C;

  /**
   * Process the request
   * @param {WebChainedContext} context The context of to process
   */
  filter(context: WebChainedContext<C>): Promise<WebResponse>;
}