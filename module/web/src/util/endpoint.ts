import { asConstructable, castTo, Class } from '@travetto/runtime';
import { BindUtil, FieldConfig, SchemaRegistry, SchemaValidator, ValidationResultError } from '@travetto/schema';

import { HttpFilter, HttpContext, HttpChainedFilter, HttpChainedContext } from '../types.ts';
import { HttpResponse } from '../types/response.ts';
import { HttpInterceptor } from '../types/interceptor.ts';
import { EndpointConfig, ControllerConfig, EndpointParamConfig } from '../registry/types.ts';

/**
 * Endpoint specific utilities
 */
export class EndpointUtil {

  static #compareEndpoints(a: number[], b: number[]): number {
    const al = a.length;
    const bl = b.length;
    if (al !== bl) {
      return bl - al;
    }
    let i = 0;
    while (i < al) {
      if (a[i] !== b[i]) {
        return b[i] - a[i];
      }
      i += 1;
    }
    return 0;
  }

  static MissingParamSymbol = Symbol();

  /**
   * Create a full filter chain given the provided filters
   * @param filters Filters to chain
   */
  static createFilterChain(filters: [HttpChainedFilter, unknown][]): HttpChainedFilter {
    const len = filters.length - 1;
    return function filterChain(ctx: HttpChainedContext, idx: number = 0): Promise<HttpResponse> {
      const [it, cfg] = filters[idx]!;
      const chainedNext = idx === len ? ctx.next : filterChain.bind(null, ctx, idx + 1);
      return it({ req: ctx.req, next: chainedNext, config: cfg });
    };
  }

  /**
   * Resolve interceptors with configs
   * @param interceptors
   * @param endpoint
   * @param controller
   */
  static resolveInterceptorsWithConfig(
    interceptors: HttpInterceptor[],
    endpoint: EndpointConfig,
    controller?: ControllerConfig
  ): [HttpInterceptor, unknown][] {

    const inputByClass = Map.groupBy(
      [...controller?.interceptorConfigs ?? [], ...endpoint.interceptorConfigs ?? []],
      x => x[0]
    );

    const configs = new Map<Class, unknown>(interceptors.map(inst => {
      const cls = asConstructable<HttpInterceptor>(inst).constructor;
      const inputs = (inputByClass.get(cls) ?? []).map(x => x[1]);
      const config = Object.assign({}, inst.config, ...inputs);
      return [cls, inst.finalizeConfig?.(config, castTo(inputs)) ?? config];
    }));

    return interceptors.map(inst => [
      inst,
      configs.get(asConstructable(inst).constructor)
    ]);
  }

  /**
   * Extract parameter from request
   */
  static extractParameter(ctx: HttpContext, param: EndpointParamConfig, field: FieldConfig, value?: unknown): unknown {
    if (value !== undefined && value !== this.MissingParamSymbol) {
      return value;
    } else if (param.extract) {
      return param.extract(ctx, param);
    }

    const name = param.name!;
    switch (param.location) {
      case 'path': return ctx.req.params[name];
      case 'header': return field.array ? ctx.req.headers.getList(name) : ctx.req.headers.get(name);
      case 'body': return ctx.req.body;
      case 'query': {
        const q = ctx.req.getExpandedQuery();
        return param.prefix ? q[param.prefix] : (field.type.Ⲑid ? q : q[name]);
      }
    }
  }

  /**
   * Extract all parameters for a given endpoint/request/response combo
   * @param endpoint The endpoint to extract for
   * @param req The request
   * @param res The response
   */
  static async extractParameters(ctx: HttpContext, endpoint: EndpointConfig): Promise<unknown[]> {
    const cls = endpoint.class;
    const method = endpoint.name;
    const vals = ctx.req.getInternal().requestParams;

    try {
      const fields = SchemaRegistry.getMethodSchema(cls, method);
      const extracted = endpoint.params.map((c, i) => this.extractParameter(ctx, c, fields[i], vals?.[i]));
      const params = BindUtil.coerceMethodParams(cls, method, extracted);
      await SchemaValidator.validateMethod(cls, method, params, endpoint.params.map(x => x.prefix));
      return params;
    } catch (err) {
      if (err instanceof ValidationResultError) {
        for (const el of err.details?.errors ?? []) {
          if (el.kind === 'required') {
            const config = endpoint.params.find(x => x.name === el.path);
            if (config) {
              el.message = `Missing ${config.location.replace(/s$/, '')}: ${config.name}`;
            }
          }
        }
      }
      throw err;
    }
  }

  /**
   * Create a full endpoint handler
   * @param interceptors Interceptors to apply
   * @param endpoint The endpoint to call
   * @param controller The controller to tie to
   */
  static createEndpointHandler(
    interceptors: HttpInterceptor[],
    endpoint: EndpointConfig,
    controller?: ControllerConfig
  ): HttpChainedFilter {

    // Filter interceptors if needed
    for (const filter of [controller?.interceptorExclude, endpoint.interceptorExclude]) {
      interceptors = filter ? interceptors.filter(x => !filter(x)) : interceptors;
    }

    const handlerBound: HttpFilter = async (ctx): Promise<HttpResponse> => {
      const params = await this.extractParameters(ctx, endpoint);
      try {
        const res = HttpResponse.from(await endpoint.endpoint.apply(endpoint.instance, params));
        return res
          .backfillHeaders(endpoint.responseHeaderMap)
          .ensureContentLength()
          .ensureContentType()
          .ensureStatusCode(ctx.req.method === 'POST' ? 201 : (ctx.req.method === 'PUT' ? 204 : 200));
      } catch (err) {
        throw HttpResponse.fromCatch(err);
      }
    };

    const filters = [
      ...(controller?.filters ?? []).map(fn => fn.bind(controller?.instance)),
      ...(endpoint.filters ?? []).map(fn => fn.bind(endpoint.instance)),
      ...(endpoint.params.filter(cfg => cfg.resolve).map(fn => fn.resolve!))
    ];

    const validInterceptors =
      this.resolveInterceptorsWithConfig(interceptors, endpoint, controller)
        .filter(([inst, cfg]) => inst.applies?.(endpoint, cfg) ?? true);

    const filterChain: [HttpChainedFilter, unknown][] = castTo([
      ...validInterceptors.map(([inst, cfg]) => [inst.filter.bind(inst), cfg]),
      ...filters.map(fn => [fn, {}]),
      [handlerBound, {}]
    ]);

    return this.createFilterChain(filterChain);
  }

  /**
   * Order endpoints by a set of rules, to ensure consistent registration and that precedence is honored
   */
  static orderEndpoints(endpoints: EndpointConfig[]): EndpointConfig[] {
    return endpoints
      .map(ep => {
        const parts = ep.path.replace(/^[/]|[/]$/g, '').split('/');
        return [ep, parts.map(x => /[*]/.test(x) ? 1 : /:/.test(x) ? 2 : 3)] as const;
      })
      .sort((a, b) => this.#compareEndpoints(a[1], b[1]) || a[0].path.localeCompare(b[0].path))
      .map(([ep, _]) => ep);
  }
}