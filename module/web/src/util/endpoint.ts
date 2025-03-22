import { asConstructable, Class } from '@travetto/runtime';
import { BindUtil, FieldConfig, SchemaRegistry, SchemaValidator, ValidationResultError } from '@travetto/schema';

import { HttpRequest, HttpFilter, HttpContext, HttpResponse, WebInternal } from '../types.ts';
import { EndpointConfig, ControllerConfig, EndpointParamConfig } from '../registry/types.ts';
import { HttpInterceptor } from '../interceptor/types.ts';

type LightweightConfig<C extends {} = {}> = { disabled?: boolean } & C;
type HttpFilterChainItem = readonly [HttpFilter, LightweightConfig | undefined];

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
  static createFilterChain(filters: HttpFilterChainItem[]): HttpFilter {
    const len = filters.length - 1;
    return function filterChain(ctx: HttpContext, idx: number = 0): ReturnType<HttpFilter> {
      const [it, cfg] = filters[idx]!;
      const chainedNext = idx === len ? ctx.next : filterChain.bind(null, ctx, idx + 1);
      return it({ ...ctx, config: cfg, next: chainedNext });
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
    resolvedConfig: LightweightConfig | undefined,
    endpoint: EndpointConfig,
    controller?: ControllerConfig
  ): boolean {
    const config = interceptor.config;

    if ((hasDisabled(config) && config.disabled) || resolvedConfig?.disabled) {
      return false;
    } else if (resolvedConfig?.disabled === false) { // If explicitly not disabled
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
    interceptors: HttpInterceptor<LightweightConfig>[],
    endpoint: EndpointConfig,
    controller?: ControllerConfig
  ): (readonly [HttpInterceptor, LightweightConfig | undefined])[] {
    const resolvedConfigs =
      [...controller?.interceptorConfigs ?? [], ...endpoint.interceptorConfigs ?? []]
        .reduce((acc, [cls, cfg]) => {
          if (!acc.has(cls)) {
            acc.set(cls, []);
          }
          acc.get(cls)!.push(cfg);
          return acc;
        }, new Map<Class, LightweightConfig[]>());

    const resolvedConfig = new Map<Class, LightweightConfig>();
    for (const inst of interceptors) {
      const cls = asConstructable(inst).constructor;
      const values = resolvedConfigs.get(cls) ?? [];
      if (inst.config) {
        let resolved =
          inst.resolveConfig?.(values) ??
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
    ] as const);
  }

  /**
   * Extract parameter from request
   */
  static extractParameter(param: EndpointParamConfig, req: HttpRequest, res: HttpResponse, field: FieldConfig, value?: unknown): unknown {
    if (value !== undefined && value !== this.MISSING_PARAM) {
      return value;
    } else if (param.extract) {
      return param.extract(param, req, res);
    }

    switch (param.location) {
      case 'path': return req.params[param.name!];
      case 'header': return req.header(param.name!);
      case 'body': return req.body;
      case 'query': {
        const q = req.getExpandedQuery();
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
  static async extractParameters(endpoint: EndpointConfig, req: HttpRequest, res: HttpResponse): Promise<unknown[]> {
    const cls = endpoint.class;
    const method = endpoint.handlerName;
    const vals = req[WebInternal].requestParams;

    try {
      const fields = SchemaRegistry.getMethodSchema(cls, method);
      const extracted = endpoint.params.map((c, i) => this.extractParameter(c, req, res, fields[i], vals?.[i]));
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

    const handlerBound: HttpFilter = async ({ req, res }: HttpContext): Promise<unknown> => {
      const params = await this.extractParameters(endpoint, req, res);
      return endpoint.handler.apply(endpoint.instance, params);
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

    const filterChain: HttpFilterChainItem[] = [
      ...validInterceptors.map(([inst, cfg]) => [inst.intercept.bind(inst), cfg] as const),
      ...filters.map(fn => [fn, undefined] as const),
      [handlerBound, undefined] as const
    ];

    if (headers && Object.keys(headers).length > 0) {
      filterChain.unshift([({ res, next }): unknown => {
        res[WebInternal].headersAdded = { ...headers };
        return next();
      }, undefined]);
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