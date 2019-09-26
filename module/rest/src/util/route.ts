import { Request, Response, Filter, RouteConfig } from '../types';
import { EndpointConfig, ControllerConfig } from '../registry/types';
import { RestInterceptor } from '../interceptor/interceptor';

import { ParamUtil } from './param';

export class RouteUtil {

  static createFilterChain(filters: (Filter | RestInterceptor['intercept'])[]): Filter<Promise<any>> {
    return function filterChain(req: Request, res: Response, idx: number = filters.length - 1): Promise<any> | any {
      const it = filters[idx];
      const next = idx === 0 ? (x?: any) => x : filterChain.bind(null, req, res, idx - 1);
      if (it.length === 3) {
        return it(req, res, next);
      } else {
        const out = it(req, res);
        return out && out.then ? out.then(next) : next();
      }
    };
  }

  static createRouteHandler(
    interceptors: RestInterceptor[],
    route: RouteConfig | EndpointConfig,
    router: Partial<ControllerConfig> = {}): Filter<any> {

    const handlerBound = async (req: Request, res: Response) => {
      const params = ParamUtil.extractParams(route.params, req, res);
      return route.handler.apply(route.instance, params);
    };

    const filters: Filter[] = [
      ...(router.filters || []).map(x => x.bind(router.instance)),
      ...('filters' in route ? route.filters : []).map(x => x.bind(route.instance)),
      ...(route.params.filter(x => x.resolve).map(x => x.resolve!))
    ];

    const headers = {
      ...(router.headers || {}),
      ...('headers' in route ? route.headers : {})
    };

    const filterChain = [
      ...interceptors
        .filter(x => x.applies ? x.applies(route) : true)
        .map(x => x.intercept.bind(x)),
      ...filters,
      handlerBound
    ];

    if (headers && Object.keys(headers).length > 1) {
      filterChain.splice(filterChain.length - 1, 0, (async (_: Request, res: Response, next: () => Promise<any>) => {
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