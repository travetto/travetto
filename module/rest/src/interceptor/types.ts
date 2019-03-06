import { Class } from '@travetto/registry';
import { DependencyRegistry } from '@travetto/di';
import { Util } from '@travetto/base';

import { RouteConfig, Request, Response } from '../types';

export abstract class RestInterceptor {
  public after?: Class<RestInterceptor>[] | Set<Class<RestInterceptor>> | Class<RestInterceptor>;
  public before?: Class<RestInterceptor>[] | Set<Class<RestInterceptor>> | Class<RestInterceptor>;
  public applies?(route: RouteConfig): boolean;

  abstract intercept(req: Request, res: Response, next: () => Promise<any>): Promise<any>;
  abstract intercept(req: Request, res: Response, next?: () => Promise<any>): Promise<void>;
}

export class RestInterceptorGroup {
  public interceptors: Set<Class<RestInterceptor>>;
  constructor(...interceptors: Class<RestInterceptor>[]) {
    this.interceptors = new Set(interceptors);
  }

  async getActive() {
    // Final all available interceptors
    const interceptors = DependencyRegistry.getCandidateTypes(RestInterceptor as Class)
      .filter(x => this.interceptors.has(x.class));

    // Get instances for all of them
    const instances = await Promise.all<RestInterceptor>(interceptors.map(op =>
      DependencyRegistry.getInstance(op.target, op.qualifier)
        .catch(err => {
          if ((err.message || '').includes('Cannot find module')) {
            console.error(`Unable to load operator ${op.class.name}#${op.qualifier.toString()}, module not found`);
          } else {
            throw err;
          }
        })
    ));

    // Sort according to before/after
    const sorted = Util.computeOrdering(
      instances
        .map(x => ({
          key: x.constructor,
          before: x.before,
          after: x.after,
          target: x
        }))
    )
      .map(x => x.target);

    console.debug('Sorting interceptors', sorted.length, sorted.map(x => x.constructor.name));

    return sorted;
  }
}