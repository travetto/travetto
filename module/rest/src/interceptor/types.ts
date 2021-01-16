import { Class } from '@travetto/base';

import { RouteConfig, Request, Response } from '../types';
import { ControllerConfig } from '../registry/types';

/**
 * Basic interceptor structure
 *
 * @concrete ../internal/types:RestInterceptorTarget
 */
export interface RestInterceptor {
  /**
   * This interceptor must run after these
   */
  after?: Class<RestInterceptor>[];
  /**
   * This interceptor must run before these
   */
  before?: Class<RestInterceptor>[];

  /**
   * Determines the current route is applicable for the interceptor
   * @param route The route to check
   * @param controller The controller the route belongs to
   */
  applies?(route: RouteConfig, controller: Partial<ControllerConfig>): boolean;

  /**
   * Actually handle the request, response when applicable
   * @param req Inbound request
   * @param res Outbound response
   * @param next
   */
  intercept(req: Request, res: Response, next?: () => Promise<unknown | void> | unknown): Promise<unknown | void> | void | unknown;
}