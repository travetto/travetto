import type { Class } from '@travetto/runtime';

import type { EndpointConfig } from '../registry/types.ts';
import type { HttpChainedContext } from '../types.ts';
import { HttpResponse } from './response.ts';
import { HttpInterceptorCategory } from './core.ts';

/**
 * Basic http interceptor structure
 *
 * @concrete
 */
export interface HttpInterceptor<C = unknown> {

  /**
   * The category an interceptor belongs to
   */
  category: HttpInterceptorCategory;

  /**
   * Config for interceptor
   */
  config?: Readonly<C>;

  /**
   * This interceptor must run after these
   */
  dependsOn?: Class<HttpInterceptor>[];

  /**
   * This interceptor must run before these
   */
  runsBefore?: Class<HttpInterceptor>[];

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
   * @param {HttpChainedContext} context The context of to process
   */
  filter(context: HttpChainedContext<C>): HttpResponse | Promise<HttpResponse>;
}