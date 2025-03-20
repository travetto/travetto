import { castTo, type Any, type Class } from '@travetto/runtime';
import { Schema } from '@travetto/schema';

import type { EndpointConfig } from '../registry/types.ts';
import type { Filter } from '../types.ts';

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
 * Http Interceptor group, used for alignment in ordering
 */
export class HttpInterceptorGroup {
  start: Class<HttpInterceptor>;
  end: Class<HttpInterceptor>;

  runsBefore: HttpInterceptorGroup[] = [];
  dependsOn: HttpInterceptorGroup[] = [];

  constructor(key: string) {
    this.start = castTo({ name: `${key}Start` });
    this.end = castTo({ name: `${key}End` });
  }
}

/**
 * Basic http interceptor structure
 *
 * @concrete
 */
export interface HttpInterceptor<C = Any> {

  /**
   * Config for interceptor
   */
  config?: Readonly<C>;

  /**
   * This interceptor must run after these
   */
  dependsOn?: (Class<HttpInterceptor> | HttpInterceptorGroup)[];

  /**
   * This interceptor must run before these
   */
  runsBefore?: (Class<HttpInterceptor> | HttpInterceptorGroup)[];

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
  intercept: Filter<C>;
}