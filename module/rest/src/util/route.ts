import { Class, Util } from '@travetto/base';

import { Request, Filter, RouteConfig, FilterContext, FilterNext, FilterReturn, RequestResponseHandler } from '../types';
import { EndpointConfig, ControllerConfig } from '../registry/types';
import { LightweightConfig, ManagedInterceptorConfig, RestInterceptor, RouteApplies } from '../interceptor/types';
import { HeadersAddedⲐ, InterceptorConfigsⲐ } from '../internal/symbol';

import { ParamExtractor } from './param';
import { RouteCheckUtil } from './route-check';

const RouteChecker = Symbol.for('@trv:rest/route-checker');

const ident: FilterNext = ((x?: unknown) => x);

function hasDisabled(o: unknown): o is { disabled: boolean } {
  return !!o && typeof o === 'object' && 'disabled' in o;
}

function hasPaths(o: unknown): o is { paths: string[] } {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return !!o && typeof o === 'object' && 'paths' in o && Array.isArray((o as Record<string, unknown>)['paths']);
}

/**
 * Route specific utilities
 */
export class RouteUtil {

  /**
   * Get the interceptor config for a given request and interceptor instance
   */
  static getInterceptorConfig<T extends RestInterceptor<U>, U extends ManagedInterceptorConfig>(req: Request, inst: T): U | undefined {
    const cfg = req[InterceptorConfigsⲐ]?.[inst.constructor.Ⲑid] ?? undefined;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return cfg as U;
  }

  /**
   * Create a full filter chain given the provided filters
   * @param filters Filters to chain
   */
  static createFilterChain(filters: (readonly [Filter] | readonly [Filter, LightweightConfig | undefined])[]): Filter {
    const len = filters.length - 1;
    return function filterChain(ctx: FilterContext, next: FilterNext, idx: number = 0): FilterReturn {
      const [it, cfg] = filters[idx]!;
      const chainedNext = idx === len ? next : filterChain.bind(null, ctx, next, idx + 1);
      const out = it({ req: ctx.req, res: ctx.res, config: cfg }, chainedNext);
      if (it.length === 2) {
        return out;
      } else if (Util.isPromise(out)) {
        return out.then(chainedNext);
      } else {
        return chainedNext();
      }
    };
  }

  /**
   * Verify route applies based on the following scenarios
   * - If general is disabled or resolved is disabled
   * - Path match on routes
   * - Interceptor level applies
   */
  static verifyRouteApplies(
    interceptor: RestInterceptor,
    resolvedConfig: LightweightConfig | undefined,
    route: RouteConfig | EndpointConfig,
    router?: ControllerConfig
  ): boolean {
    const config = interceptor.config;

    if ((hasDisabled(config) && config.disabled) || resolvedConfig?.disabled) {
      return false;
    } else if (resolvedConfig?.disabled === false) { // If explicitly not disabled
      return true;
    }

    // Verify if route applies matches, let it override interceptor-level applies
    if (hasPaths(config) && config.paths.length) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const applies = (config as unknown as { [RouteChecker]: RouteApplies })[RouteChecker] ??= RouteCheckUtil.matcher(config.paths);
      const result = applies(route, router);
      console.log('Verifying paths', interceptor.constructor.name, router?.basePath, route.path, config.paths, result);
      if (result === false) {
        return result;
      }
    }

    // Fallback to interceptor level applies when paths haven't overridden
    return interceptor.applies?.(route, router) ?? true;
  }

  /**
   * Resolve interceptors with configs
   * @param interceptors
   * @param route
   * @param router
   */
  static resolveInterceptorsWithConfig(
    interceptors: RestInterceptor[],
    route: RouteConfig | EndpointConfig,
    router?: ControllerConfig
  ): (readonly [RestInterceptor, LightweightConfig | undefined])[] {
    const resolvedConfigs =
      [...router?.interceptors ?? [], ...route.interceptors ?? []]
        .reduce((acc, [cls, cfg]) => {
          if (!acc.has(cls)) {
            acc.set(cls, []);
          }
          acc.get(cls)!.push(cfg);
          return acc;
        }, new Map<Class, LightweightConfig[]>());

    const resolvedConfig = new Map<Class, LightweightConfig>();
    for (const inst of interceptors) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const cls = inst.constructor as Class;
      const values = resolvedConfigs.get(cls) ?? [];
      if (inst.config) {
        let resolved =
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          inst.resolveConfig?.(values) as unknown as LightweightConfig ??
          Object.assign({}, inst.config, ...values);

        if (inst.finalizeConfig) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          resolved = inst.finalizeConfig(resolved) as typeof resolved;
        }
        resolvedConfig.set(cls, resolved);
      } else {
        resolvedConfig.set(cls, {});
      }
    }
    return interceptors
      .map(x => [
        x,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        resolvedConfig.get(x.constructor as Class)
      ] as const);
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
    router?: ControllerConfig
  ): RequestResponseHandler {

    const handlerBound: Filter = async ({ req, res }: FilterContext): Promise<unknown> => {
      if ('class' in route) {
        const params = ParamExtractor.extract(route, req, res);
        return route.handler.apply(route.instance, params);
      } else {
        return route.handler.call(route.instance, req, res);
      }
    };

    const filters: Filter[] = [
      ...(router?.filters ?? []).map(fn => fn.bind(router?.instance)),
      ...('filters' in route ? route.filters : []).map(fn => fn.bind(route.instance)),
      ...(route.params.filter(cfg => cfg.resolve).map(fn => fn.resolve!))
    ];

    const headers = {
      ...(router?.headers ?? {}),
      ...('headers' in route ? route.headers : {})
    };

    const validInterceptors =
      this.resolveInterceptorsWithConfig(interceptors, route, router)
        .filter(([inst, cfg]) => this.verifyRouteApplies(inst, cfg, route, router));

    const filterChain: (readonly [Filter, LightweightConfig | undefined])[] = [
      ...validInterceptors.map(([inst, cfg]) => [inst.intercept.bind(inst), cfg] as const),
      ...filters.map(fn => [fn, undefined] as const),
      [handlerBound, undefined] as const
    ];

    if (headers && Object.keys(headers).length > 0) {
      filterChain.unshift([({ res }): void => { res[HeadersAddedⲐ] = { ...headers }; }, undefined]);
    }

    const chain = this.createFilterChain(filterChain);
    return (req, res) => chain({ req, res, config: undefined }, ident);
  }
}