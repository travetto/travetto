import { Class } from '@travetto/registry';

import { RouteConfig, Request, Response } from '../types';

export abstract class RestInterceptor {
  public after?: Class<RestInterceptor>[] | Set<Class<RestInterceptor>> | Class<RestInterceptor>;
  public before?: Class<RestInterceptor>[] | Set<Class<RestInterceptor>> | Class<RestInterceptor>;
  public applies?(route: RouteConfig): boolean;

  abstract intercept(req: Request, res: Response, next: () => Promise<any>): Promise<any>;
  abstract intercept(req: Request, res: Response, next?: () => Promise<any>): Promise<void>;
}