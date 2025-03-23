import { asConstructable, castTo, Class } from '@travetto/runtime';
import { BindUtil, FieldConfig, SchemaRegistry, SchemaValidator, ValidationResultError } from '@travetto/schema';

import { HttpFilter, HttpContext, WebInternal, HttpChainedFilter, HttpChainedContext } from '../types.ts';
import { EndpointConfig, ControllerConfig, EndpointParamConfig } from '../registry/types.ts';
import { HttpInterceptor } from '../interceptor/types.ts';

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

  static MISSING_PARAM = Symbol.for('@travetto/web:missing-param');

  /**
   * Create a full filter chain given the provided filters
   * @param filters Filters to chain
   */
  static createFilterChain(filters: [HttpChainedFilter, unknown][]): HttpChainedFilter {
    const len = filters.length - 1;
    return function filterChain(ctx: HttpChainedContext, idx: number = 0): unknown {
      const [it, cfg] = filters[idx]!;
      const chainedNext = idx === len ? ctx.next : filterChain.bind(null, ctx, idx + 1);
      return it({ req: ctx.req, res: ctx.res, next: chainedNext, config: cfg });
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

    const inputByClass = new Map<Class, unknown[]>();
    for (const [cls, cfg] of [...controller?.interceptorConfigs ?? [], ...endpoint.interceptorConfigs ?? []]) {
      if (!inputByClass.has(cls)) {
        inputByClass.set(cls, []);
      }
      inputByClass.get(cls)!.push(cfg);
    }

    const configs = new Map<Class, unknown>(interceptors.map(inst => {
      const cls = asConstructable(inst).constructor;
      const inputs = inputByClass.get(cls) ?? [];
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
    if (value !== undefined && value !== this.MISSING_PARAM) {
      return value;
    } else if (param.extract) {
      return param.extract(ctx, param);
    }

    switch (param.location) {
      case 'path': return ctx.req.params[param.name!];
      case 'header': return field.array ? ctx.req.headerList(param.name!) : ctx.req.headerFirst(param.name!);
      case 'body': return ctx.req.body;
      case 'query': {
        const q = ctx.req.getExpandedQuery();
        return param.prefix ? q[param.prefix] : (field.type.Ⲑid ? q : q[param.name!]);
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
    const vals = ctx.req[WebInternal].requestParams;

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

    const handlerBound: HttpFilter = async (ctx): Promise<unknown> => {
      const params = await this.extractParameters(ctx, endpoint);
      return endpoint.endpoint.apply(endpoint.instance, params);
    };

    const filters = [
      ...(controller?.filters ?? []).map(fn => fn.bind(controller?.instance)),
      ...('filters' in endpoint ? endpoint.filters : []).map(fn => fn.bind(endpoint.instance)),
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

    const headers = {
      ...(controller?.headers ?? {}),
      ...('headers' in endpoint ? endpoint.headers : {})
    };

    if (Object.keys(headers).length > 0) {
      filterChain.unshift([(c): unknown => (c.res[WebInternal].headersAdded = { ...headers }, c.next()), {}]);
    }

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