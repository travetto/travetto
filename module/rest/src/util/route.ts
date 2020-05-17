import { Request, Response, Filter, RouteConfig } from '../types';
import { EndpointConfig, ControllerConfig } from '../registry/types';
import { RestInterceptor } from '../interceptor/interceptor';

import { ParamUtil } from './param';

/**
 * Route specific utilities
 */
export class RouteUtil {

  /**
   * Create a full filter chain given the provided filters
   * @param filters Filters to chain
   */
  static createFilterChain(filters: (Filter | RestInterceptor['intercept'])[]): Filter<Promise<any>> {
    return function filterChain(req: Request, res: Response, idx: number = filters.length - 1): Promise<any> | any {
      const it = filters[idx];
      const next = idx === 0 ? (x?: any) => x : filterChain.bind(null, req, res, idx - 1);
      if (it.length === 3) {
        return it(req, res, next);
      } else {
        const out = it(req, res);
        return out?.then(next) ?? next();
      }
    };
  }

  /**
   * Create a full route handler
   * @param interceptors Intercpetors to apply
   * @param route The route/endpoint to call
   * @param router The controller to tie to
   */
  static createRouteHandler(
    interceptors: RestInterceptor[],
    route: RouteConfig | EndpointConfig,
    router: Partial<ControllerConfig> = {}): Filter<any> {

    const handlerBound = async (req: Request, res: Response) => {
      const params = ParamUtil.extractParams(route.params, req, res);
      return route.handler.apply(route.instance, params);
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

    if (headers && Object.keys(headers).length > 1) {
      filterChain.splice(filterChain.length - 1, 0, (async (__: Request, res: Response, next: () => Promise<any>) => {
        try {
          return await next();
        } finally {
          if (!res.headersSent) {
            for (const [h, v] of Object.entries(headers)) {
              res.setHeader(h, typeof v === 'string' ? v : v());
            }
          }
        }
      }));
    }

    const chain = this.createFilterChain(filterChain.reverse());
    return (req, res) => chain(req, res);
  }
}