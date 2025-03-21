import { type Any, type Class } from '@travetto/runtime';
import { Schema } from '@travetto/schema';

import type { EndpointConfig } from '../registry/types.ts';
import type { HttpFilter } from '../types.ts';

export type EndpointApplies = (endpoint: EndpointConfig, config?: { basePath: string }) => boolean;

export type LightweightConfig = ({ disabled?: boolean } & Record<string, unknown>);

@Schema()
export abstract class ManagedInterceptorConfig {
  /**
   * Interceptor mode, defaults to 'opt-out'
   */
  disabled?: boolean;

  /**
   * Path specific overrides
   */
  paths?: string[];
}

/**
 * High level categories with a defined ordering
 */
export const HTTP_INTERCEPTOR_CATEGORIES = ['global', 'terminal', 'request', 'response', 'application', 'unbound'] as const;

/**
 * High level categories with a defined ordering
 */
export type HttpInterceptorCategory = (typeof HTTP_INTERCEPTOR_CATEGORIES)[number];

/**
 * Basic http interceptor structure
 *
 * @concrete
 */
export interface HttpInterceptor<C = Any> {

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
   * @param controller The controller the endpoint belongs to
   */
  applies?: EndpointApplies;

  /**
   * Is this a placeholder filter
   */
  placeholder?: boolean;

  /**
   * Resolve set of partial configs against core configuration
   */
  resolveConfig?(partials: Partial<C>[]): C;

  /**
   * Finalize config before use
   */
  finalizeConfig?(config: C): C;

  /**
   * Actually handle the request, response when applicable
   * @param context interceptor context
   * @param next
   */
  intercept: HttpFilter<C>;
}