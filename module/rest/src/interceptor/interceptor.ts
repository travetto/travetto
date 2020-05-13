import { Class } from '@travetto/registry';

import { RouteConfig, Request, Response } from '../types';
import { ControllerConfig } from '../registry/types';

// TODO: Document
export abstract class RestInterceptor {
  public after?: Class<RestInterceptor>[];
  public before?: Class<RestInterceptor>[];

  public applies?(route: RouteConfig, controller: Partial<ControllerConfig>): boolean;
  abstract intercept(req: Request, res: Response, next?: () => Promise<any>): Promise<any> | void;
}