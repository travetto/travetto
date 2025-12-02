import { asConstructable, castKey, castTo, Class, Runtime, TypedObject } from '@travetto/runtime';
import { BindUtil, SchemaParameterConfig, SchemaRegistryIndex, SchemaValidator, ValidationResultError } from '@travetto/schema';
import { DependencyRegistryIndex } from '@travetto/di';
import { RetargettingProxy } from '@travetto/registry';

import { WebChainedFilter, WebChainedContext, WebFilter } from '../types/filter.ts';
import { WebResponse } from '../types/response.ts';
import { WebInterceptor } from '../types/interceptor.ts';
import { WebRequest } from '../types/request.ts';
import { WEB_INTERCEPTOR_CATEGORIES } from '../types/core.ts';
import { EndpointConfig, ControllerConfig, EndpointParameterConfig, EndpointFunction } from '../registry/types.ts';
import { ControllerRegistryIndex } from '../registry/registry-index.ts';
import { WebCommonUtil } from './common.ts';


const WebQueryExpandedSymbol = Symbol();

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
      return filter({ request: ctx.request, next: chainedNext, config });
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
      return [cls, inst.finalizeConfig?.({ config, endpoint }, castTo(inputs)) ?? config];
    }));

    return interceptors.map(inst => [
      inst,
      configs.get(asConstructable(inst).constructor)
    ]);
  }


  /**
   * Extract parameter value from request
   * @param request The request
   * @param param The parameter config
   * @param name The parameter name
   * @param isArray Whether the parameter is an array
   */
  static extractParameterValue(request: WebRequest, param: EndpointParameterConfig, name: string, isArray?: boolean): unknown {
    switch (param.location) {
      case 'body': return request.body;
      case 'path': return request.context.pathParams?.[name];
      case 'header': return isArray ? request.headers.getList(name) : request.headers.get(name);
      case 'query': {
        const withQuery: typeof request & { [WebQueryExpandedSymbol]?: Record<string, unknown> } = request;
        const q = withQuery[WebQueryExpandedSymbol] ??= BindUtil.expandPaths(request.context.httpQuery ?? {});
        return q[name];
      }
    }
  }

  /**
   * Extract parameter from request
   * @param request The request
   * @param param The parameter config
   * @param input The schema parameter config
   */
  static extractParameter(request: WebRequest, param: EndpointParameterConfig, input: SchemaParameterConfig): unknown {
    if (param.extract) {
      return param.extract(request, param);
    } else if (param.location === 'query') {
      // TODO: Revisit this logic?
      const withQuery: typeof request & { [WebQueryExpandedSymbol]?: Record<string, unknown> } = request;
      const q = withQuery[WebQueryExpandedSymbol] ??= BindUtil.expandPaths(request.context.httpQuery ?? {});
      if (param.prefix) { // Has a prefix provided
        return q[param.prefix];
      } else if (input.type.Ⲑid) { // Is a full type
        return q;
      }
    }

    let result = this.extractParameterValue(request, param, input.name!.toString(), input.array) ?? undefined;
    for (let i = 0; result === undefined && input.aliases && i < input.aliases.length; i += 1) {
      result = this.extractParameterValue(request, param, input.aliases[i], input.array) ?? undefined;
    }
    return result;
  }

  /**
   * Extract all parameters for a given endpoint/request/response combo
   * @param endpoint The endpoint to extract for
   * @param request The request
   */
  static async extractParameters(endpoint: EndpointConfig, request: WebRequest): Promise<unknown[]> {
    const cls = endpoint.class;
    const vals = WebCommonUtil.getRequestParams(request);
    const { parameters } = SchemaRegistryIndex.get(cls).getMethod(endpoint.methodName);
    const combined = parameters.map((cfg) =>
      ({ schema: cfg, param: endpoint.parameters[cfg.index], value: vals?.[cfg.index] }));

    try {
      const extracted = combined.map(({ param, schema, value }) =>
        (value !== undefined && value !== this.MissingParamSymbol) ?
          value :
          this.extractParameter(request, param, schema)
      );
      const params = BindUtil.coerceMethodParams(cls, endpoint.methodName, extracted);
      await SchemaValidator.validateMethod(cls, endpoint.methodName, params, endpoint.parameters.map(x => x.prefix));
      return params;
    } catch (error) {
      if (error instanceof ValidationResultError) {
        for (const el of error.details?.errors ?? []) {
          if (el.kind === 'required') {
            const config = combined.find(x => x.schema.name === el.path);
            if (config) {
              el.message = `Missing ${config.param.location} value: ${config.schema.name}`;
            }
          }
        }
      }
      throw error;
    }
  }

  /**
   * Endpoint invocation code
   */
  static async invokeEndpoint(endpoint: EndpointConfig, { request }: WebChainedContext): Promise<WebResponse> {
    try {
      const params = await this.extractParameters(endpoint, request);
      const body = await castTo<EndpointFunction>(endpoint.instance![castKey(endpoint.methodName)]).apply(endpoint.instance, params);
      const headers = endpoint.finalizedResponseHeaders;
      let response: WebResponse;
      if (body instanceof WebResponse) {
        for (const [k, v] of headers) { body.headers.setIfAbsent(k, v); }
        // Rewrite context
        Object.assign(body.context, { ...endpoint.responseContext, ...body.context });
        response = body;
      } else {
        response = new WebResponse({ body, headers, context: { ...endpoint.responseContext } });
      }
      return endpoint.responseFinalizer?.(response) ?? response;
    } catch (error) {
      throw WebCommonUtil.catchResponse(error);
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
        .filter(([inst, config]) => inst.applies?.({ endpoint, config }) ?? true)
        .map(([inst, config]) => ({ filter: inst.filter.bind(inst), config }));

    const endpointFilters = [
      ...(controller?.filters ?? []).map(fn => fn.bind(controller?.instance)),
      ...(endpoint.filters ?? []).map(fn => fn.bind(endpoint.instance)),
      ...(endpoint.parameters.filter(cfg => cfg.resolve).map(fn => fn.resolve!))
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
    const config = ControllerRegistryIndex.getConfig(c);

    // Skip registering conditional controllers
    if (config.conditional && !await config.conditional()) {
      return [];
    }

    config.instance = await DependencyRegistryIndex.getInstance(config.class);

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
      .map(([ep,]) => ep);
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