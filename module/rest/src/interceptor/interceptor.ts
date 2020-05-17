import { Class } from '@travetto/registry';

import { RouteConfig, Request, Response } from '../types';
import { ControllerConfig } from '../registry/types';

/**
 * Basic interceptor structure
 */
export abstract class RestInterceptor {
  /**
   * This interceptor must run after these
   */
  public after?: Class<RestInterceptor>[];
  /**
   * This interceptor must run before these
   */
  public before?: Class<RestInterceptor>[];

  /**
   * Determines the current route is applicable for the interceptor
   * @param route The route to check
   * @param controller The controller the route belongs to
   */
  public applies?(route: RouteConfig, controller: Partial<ControllerConfig>): boolean;

  /**
   * Actuall handle the request, response when applicable
   * @param req Inbound request
   * @param res Outbound response
   * @param next
   */
  abstract intercept(req: Request, res: Response, next?: () => Promise<any>): Promise<any> | void;
}