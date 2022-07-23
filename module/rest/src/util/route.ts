import { Request, Response, Filter, RouteConfig } from '../types';
import { EndpointConfig, ControllerConfig } from '../registry/types';
import { RestInterceptor } from '../interceptor/types';
import { HeadersAddedⲐ } from '../internal/symbol';

import { ParamUtil } from './param';

/**
 * Route specific utilities
 */
export class RouteUtil {

  /**
   * Create a full filter chain given the provided filters
   * @param filters Filters to chain
   */
  static createFilterChain(filters: (Filter | RestInterceptor['intercept'])[]): Filter {
    const max = filters.length - 1;
    return function filterChain(req: Request, res: Response, idx: number = 0): Promise<unknown | void> | unknown {
      const it = filters[idx]!;
      const next = idx === max ? (x?: unknown): unknown => x : filterChain.bind(null, req, res, idx + 1);
      if (it.length === 3) {
        return it(req, res, next);
      } else {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const out: Promise<unknown> | undefined = (it as Filter)(req, res);
        return out?.then(next) ?? next();
      }
    };
  }

  /**
   * Create a full route handler
   * @param interceptors Interceptors to apply
   * @param route The route/endpoint to call
   * @param router The controller to tie to
   */
  static createRouteHandler(
    interceptors: RestInterceptor[],
    route: RouteConfig | EndpointConfig,
    router: Partial<ControllerConfig> = {}): Filter {

    const handlerBound = async (req: Request, res: Response): Promise<unknown> => {
      if ('class' in route) {
        const params = ParamUtil.extractParams(route, req, res);
        return route.handler.apply(route.instance, params);
      } else {
        return route.handler.call(route.instance, req, res);
      }
    };

    const filters: Filter[] = [
      ...(router.filters ?? []).map(x => x.bind(router.instance)),
      ...('filters' in route ? route.filters : []).map(x => x.bind(route.instance)),
      ...(route.params.filter(x => x.resolve).map(x => x.resolve!))
    ];

    const headers = {
      ...(router.headers ?? {}),
      ...('headers' in route ? route.headers : {})
    };

    const filterChain = [
      ...interceptors
        .filter(x => x.applies ? x.applies(route, router) : true)
        .map(x => x.intercept.bind(x)),
      ...filters,
      handlerBound
    ];

    if (headers && Object.keys(headers).length > 0) {
      filterChain.unshift((async (__: Request, res: Response, next: () => Promise<unknown | void>) => {
        res[HeadersAddedⲐ] = { ...headers };
        return next();
      }));
    }

    const chain = this.createFilterChain(filterChain);
    return (req, res) => chain(req, res);
  }
}