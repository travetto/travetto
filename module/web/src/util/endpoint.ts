import { asConstructable, castTo, Class, Runtime, TypedObject } from '@travetto/runtime';
import { BindUtil, FieldConfig, SchemaRegistry, SchemaValidator, ValidationResultError } from '@travetto/schema';
import { DependencyRegistry } from '@travetto/di';
import { RetargettingProxy } from '@travetto/registry';

import { WebFilterContext, WebChainedFilter, WebChainedContext, WebFilter } from '../types.ts';
import { WebResponse } from '../types/response.ts';
import { WebInterceptor } from '../types/interceptor.ts';

import { WebInternalSymbol, HTTP_METHODS, WEB_INTERCEPTOR_CATEGORIES } from '../types/core.ts';
import { EndpointConfig, ControllerConfig, EndpointParamConfig } from '../registry/types.ts';
import { ControllerRegistry } from '../registry/controller.ts';

import { WebCommonUtil } from './common.ts';

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
  static createFilterChain(filters: { filter: WebChainedFilter, config?: unknown }[]): WebChainedFilter {
    const len = filters.length - 1;
    return function filterChain(ctx: WebChainedContext, idx: number = 0): Promise<WebResponse> {
      const { filter, config } = filters[idx]!;
      const chainedNext = idx === len ? ctx.next : filterChain.bind(null, ctx, idx + 1);
      return filter({ req: ctx.req, next: chainedNext, config });
    };
  }

  /**
   * Resolve interceptors with configs
   * @param interceptors
   * @param endpoint
   * @param controller
   */
  static resolveInterceptorsWithConfig(
    interceptors: WebInterceptor[],
    endpoint: EndpointConfig,
    controller?: ControllerConfig
  ): [WebInterceptor, unknown][] {

    const inputByClass = Map.groupBy(
      [...controller?.interceptorConfigs ?? [], ...endpoint.interceptorConfigs ?? []],
      x => x[0]
    );

    const configs = new Map<Class, unknown>(interceptors.map(inst => {
      const cls = asConstructable<WebInterceptor>(inst).constructor;
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
  static extractParameter(ctx: WebFilterContext, param: EndpointParamConfig, field: FieldConfig, value?: unknown): unknown {
    if (value !== undefined && value !== this.MissingParamSymbol) {
      return value;
    } else if (param.extract) {
      return param.extract(ctx, param);
    }

    const name = param.name!;
    const { req } = ctx;
    switch (param.location) {
      case 'path': return req.params[name];
      case 'header': return field.array ? req.headers.getList(name) : req.headers.get(name);
      case 'body': return req.body;
      case 'query': {
        const q = req[WebInternalSymbol].expandedQuery ??= BindUtil.expandPaths(req.query);
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
  static async extractParameters(ctx: WebFilterContext, endpoint: EndpointConfig): Promise<unknown[]> {
    const cls = endpoint.class;
    const method = endpoint.name;
    const vals = ctx.req[WebInternalSymbol]?.requestParams ?? [];

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
   * Endpoint invocation code
   */
  static async invokeEndpoint(endpoint: EndpointConfig, ctx: WebFilterContext): Promise<WebResponse> {
    const params = await this.extractParameters(ctx, endpoint);
    try {
      const body = await endpoint.endpoint.apply(endpoint.instance, params);
      if (body instanceof WebResponse) {
        return body;
      } else {
        const statusCode = (body === null || body === undefined) ? HTTP_METHODS[ctx.req.method].emptyStatusCode : 200;
        const res = new WebResponse({ body, statusCode });
        for (const [k, v] of endpoint.responseHeaderMap) {
          res.headers.setIfAbsent(k, v);
        }
        return res;
      }
    } catch (err) {
      throw WebResponse.fromCatch(err);
    }
  }

  /**
   * Create a full endpoint handler
   * @param interceptors Interceptors to apply
   * @param endpoint The endpoint to call
   * @param controller The controller to tie to
   */
  static createEndpointHandler(
    interceptors: WebInterceptor[],
    endpoint: EndpointConfig,
    controller?: ControllerConfig
  ): WebFilter {

    // Filter interceptors if needed
    for (const filter of [controller?.interceptorExclude, endpoint.interceptorExclude]) {
      interceptors = filter ? interceptors.filter(x => !filter(x)) : interceptors;
    }

    const interceptorFilters =
      this.resolveInterceptorsWithConfig(interceptors, endpoint, controller)
        .filter(([inst, cfg]) => inst.applies?.(endpoint, cfg) ?? true)
        .map(([inst, config]) => ({ filter: inst.filter.bind(inst), config }));

    const endpointFilters = [
      ...(controller?.filters ?? []).map(fn => fn.bind(controller?.instance)),
      ...(endpoint.filters ?? []).map(fn => fn.bind(endpoint.instance)),
      ...(endpoint.params.filter(cfg => cfg.resolve).map(fn => fn.resolve!))
    ]
      .map(fn => ({ filter: fn }));

    const result = this.createFilterChain([
      ...interceptorFilters,
      ...endpointFilters,
      { filter: this.invokeEndpoint.bind(this, endpoint) }
    ]);

    return castTo(result);
  }


  /**
   * Get bound endpoints, honoring the conditional status
   */
  static async getBoundEndpoints(c: Class): Promise<EndpointConfig[]> {
    const config = ControllerRegistry.get(c);

    // Skip registering conditional controllers
    if (config.conditional && !await config.conditional()) {
      return [];
    }

    config.instance = await DependencyRegistry.getInstance(config.class);

    if (Runtime.dynamic) {
      config.instance = RetargettingProxy.unwrap(config.instance);
    }

    // Filter out conditional endpoints
    const endpoints = (await Promise.all(
      config.endpoints.map(ep => Promise.resolve(ep.conditional?.() ?? true).then(v => v ? ep : undefined))
    )).filter(x => !!x);

    if (!endpoints.length) {
      return [];
    }

    for (const ep of endpoints) {
      ep.instance = config.instance;
    }

    return endpoints;
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
      .toSorted((a, b) => this.#compareEndpoints(a[1], b[1]) || a[0].path.localeCompare(b[0].path))
      .map(([ep, _]) => ep);
  }


  /**
   * Order interceptors
   */
  static orderInterceptors(instances: WebInterceptor[]): WebInterceptor[] {
    const cats = WEB_INTERCEPTOR_CATEGORIES.map(x => ({
      key: x,
      start: castTo<Class<WebInterceptor>>({ name: `${x}Start` }),
      end: castTo<Class<WebInterceptor>>({ name: `${x}End` }),
    }));

    const categoryMapping = TypedObject.fromEntries(cats.map(x => [x.key, x]));

    const ordered = instances.map(x => {
      const group = categoryMapping[x.category];
      const after = [...x.dependsOn ?? [], group.start];
      const before = [...x.runsBefore ?? [], group.end];
      return ({ key: x.constructor, before, after, target: x, placeholder: false });
    });

    // Add category sets into the ordering
    let i = 0;
    for (const cat of cats) {
      const prevEnd = cats[i - 1]?.end ? [cats[i - 1].end] : [];
      ordered.push(
        { key: cat.start, before: [cat.end], after: prevEnd, placeholder: true, target: undefined! },
        { key: cat.end, before: [], after: [cat.start], placeholder: true, target: undefined! }
      );
      i += 1;
    }

    return WebCommonUtil.ordered(ordered)
      .filter(x => !x.placeholder)  // Drop out the placeholders
      .map(x => x.target);
  }
}