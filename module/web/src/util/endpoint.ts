import { asConstructable, castTo, Class } from '@travetto/runtime';
import { BindUtil, FieldConfig, SchemaRegistry, SchemaValidator, ValidationResultError } from '@travetto/schema';

import { HttpFilter, HttpContext, WebInternal, NextFunction } from '../types.ts';
import { EndpointConfig, ControllerConfig, EndpointParamConfig } from '../registry/types.ts';
import { HttpInterceptor } from '../interceptor/types.ts';

const hasDisabled = (o: unknown): o is { disabled: boolean } => !!o && typeof o === 'object' && 'disabled' in o;

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
  static createFilterChain(filters: [HttpFilter, unknown][]): HttpFilter {
    const len = filters.length - 1;
    return function filterChain(ctx: HttpContext, next: NextFunction, idx: number = 0): unknown {
      const [it, cfg] = filters[idx]!;
      const chainedNext = idx === len ? next : filterChain.bind(null, ctx, next, idx + 1);
      return it({ ...ctx, config: cfg }, chainedNext);
    };
  }

  /**
   * Verify endpoint applies based on the following scenarios
   * - If general is disabled or resolved is disabled
   * - Path match on endpoints
   * - Interceptor level applies
   */
  static verifyEndpointApplies(
    interceptor: HttpInterceptor,
    resolvedConfig: unknown,
    endpoint: EndpointConfig,
    controller?: ControllerConfig
  ): boolean {
    const config = interceptor.config;

    if ((hasDisabled(config) && config.disabled) || (hasDisabled(resolvedConfig) && resolvedConfig?.disabled)) {
      return false;
    } else if (hasDisabled(resolvedConfig) && resolvedConfig?.disabled === false) { // If explicitly not disabled
      return true;
    }

    // Fallback to interceptor level applies when paths haven't overridden
    return interceptor.applies?.(endpoint, controller) ?? true;
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
    const resolvedConfigs =
      [...controller?.interceptorConfigs ?? [], ...endpoint.interceptorConfigs ?? []]
        .reduce((acc, [cls, cfg]) => {
          if (!acc.has(cls)) {
            acc.set(cls, []);
          }
          acc.get(cls)!.push(cfg);
          return acc;
        }, new Map<Class, unknown[]>());

    const resolvedConfig = new Map<Class, unknown>();
    for (const inst of interceptors) {
      const cls = asConstructable(inst).constructor;
      const values = resolvedConfigs.get(cls) ?? [];
      if (inst.config) {
        let resolved =
          inst.resolveConfig?.(castTo(values)) ??
          (values.length ? Object.assign({}, inst.config, ...values) : inst.config);

        if (inst.finalizeConfig) {
          resolved = inst.finalizeConfig(resolved);
        }
        resolvedConfig.set(cls, resolved);
      } else {
        resolvedConfig.set(cls, {});
      }
    }
    return interceptors.map(inst => [
      inst,
      resolvedConfig.get(asConstructable(inst).constructor)
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
      case 'header': return ctx.req.header(param.name!);
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
  ): HttpFilter {

    // Filter interceptors if needed
    for (const filter of [controller?.interceptorExclude, endpoint.interceptorExclude]) {
      interceptors = filter ? interceptors.filter(x => !filter(x)) : interceptors;
    }

    const handlerBound: HttpFilter = async (ctx): Promise<unknown> => {
      const params = await this.extractParameters(ctx, endpoint);
      return endpoint.endpoint.apply(endpoint.instance, params);
    };

    const filters: HttpFilter[] = [
      ...(controller?.filters ?? []).map(fn => fn.bind(controller?.instance)),
      ...('filters' in endpoint ? endpoint.filters : []).map(fn => fn.bind(endpoint.instance)),
      ...(endpoint.params.filter(cfg => cfg.resolve).map(fn => fn.resolve!))
    ];

    const headers = {
      ...(controller?.headers ?? {}),
      ...('headers' in endpoint ? endpoint.headers : {})
    };

    const validInterceptors =
      this.resolveInterceptorsWithConfig(interceptors, endpoint, controller)
        .filter(([inst, cfg]) => this.verifyEndpointApplies(inst, cfg, endpoint, controller));

    const filterChain: [HttpFilter, unknown][] = castTo([
      ...validInterceptors.map(([inst, cfg]) => [inst.filter.bind(inst), cfg]),
      ...filters.map(fn => [fn, {}]),
      [handlerBound, {}]
    ]);

    if (headers && Object.keys(headers).length > 0) {
      filterChain.unshift([(c, next): unknown => (c.res[WebInternal].headersAdded = { ...headers }, next()), {}]);
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