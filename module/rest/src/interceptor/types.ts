import { Class } from '@travetto/base';
import { Schema } from '@travetto/schema';

import { RouteConfig, Filter } from '../types';
import { ControllerConfig } from '../registry/types';

export type RouteApplies = (route: RouteConfig, controller?: ControllerConfig) => boolean;

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
 * Basic interceptor structure
 *
 * @concrete ../internal/types:RestInterceptorTarget
 */
export interface RestInterceptor<C = unknown> {

  /**
   * Config for interceptor
   */
  config?: C;
  /**
   * This interceptor must run after these
   */
  after?: Class<RestInterceptor<any>>[];
  /**
   * This interceptor must run before these
   */
  before?: Class<RestInterceptor<any>>[];

  /**
   * Determines the current route is applicable for the interceptor
   * @param route The route to check
   * @param controller The controller the route belongs to
   */
  applies?: RouteApplies;

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