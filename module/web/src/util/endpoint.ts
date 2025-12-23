import { asConstructable, castKey, castTo, Class, TypedObject } from '@travetto/runtime';
import { BindUtil, SchemaParameterConfig, SchemaRegistryIndex, SchemaValidator, ValidationResultError } from '@travetto/schema';
import { DependencyRegistryIndex } from '@travetto/di';

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
      entry => entry[0]
    );

    const configs = new Map<Class, unknown>(interceptors.map(inst => {
      const cls = asConstructable<WebInterceptor>(inst).constructor;
      const inputs = (inputByClass.get(cls) ?? []).map(entry => entry[1]);
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
        const query = withQuery[WebQueryExpandedSymbol] ??= BindUtil.expandPaths(request.context.httpQuery ?? {});
        return query[name];
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
      const query = withQuery[WebQueryExpandedSymbol] ??= BindUtil.expandPaths(request.context.httpQuery ?? {});
      if (param.prefix) { // Has a prefix provided
        return query[param.prefix];
      } else if (input.type.Ⲑid) { // Is a full type
        return query;
      }
    }

    let result = this.extractParameterValue(request, param, input.name!, input.array) ?? undefined;
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
    const combined = parameters.map((config) =>
      ({ schema: config, param: endpoint.parameters[config.index], value: vals?.[config.index] }));

    try {
      const extracted = combined.map(({ param, schema, value }) =>
        (value !== undefined && value !== this.MissingParamSymbol) ?
          value :
          this.extractParameter(request, param, schema)
      );
      const params = BindUtil.coerceMethodParams(cls, endpoint.methodName, extracted);
      await SchemaValidator.validateMethod(cls, endpoint.methodName, params, endpoint.parameters.map(paramConfig => paramConfig.prefix));
      return params;
    } catch (error) {
      if (error instanceof ValidationResultError) {
        for (const validationError of error.details?.errors ?? []) {
          if (validationError.kind === 'required') {
            const config = combined.find(paramConfig => paramConfig.schema.name === validationError.path);
            if (config) {
              validationError.message = `Missing ${config.param.location} value: ${config.schema.name}`;
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
        for (const [key, value] of headers) { body.headers.setIfAbsent(key, value); }
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
      interceptors = filter ? interceptors.filter(interceptor => !filter(interceptor)) : interceptors;
    }

    const interceptorFilters =
      this.resolveInterceptorsWithConfig(interceptors, endpoint, controller)
        .filter(([inst, config]) => inst.applies?.({ endpoint, config }) ?? true)
        .map(([inst, config]) => ({ filter: inst.filter.bind(inst), config }));

    const endpointFilters = [
      ...(controller?.filters ?? []).map(fn => fn.bind(controller?.instance)),
      ...(endpoint.filters ?? []).map(fn => fn.bind(endpoint.instance)),
      ...(endpoint.parameters.filter(config => config.resolve).map(fn => fn.resolve!))
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
  static async getBoundEndpoints(cls: Class): Promise<EndpointConfig[]> {
    const config = ControllerRegistryIndex.getConfig(cls);

    // Skip registering conditional controllers
    if (config.conditional && !await config.conditional()) {
      return [];
    }

    config.instance = await DependencyRegistryIndex.getInstance(config.class);

    // Filter out conditional endpoints
    const endpoints = (await Promise.all(
      config.endpoints.map(endpoint => Promise.resolve(endpoint.conditional?.() ?? true).then(value => value ? endpoint : undefined))
    )).filter(endpoint => !!endpoint);

    if (!endpoints.length) {
      return [];
    }

    for (const endpoint of endpoints) {
      endpoint.instance = config.instance;
    }

    return endpoints;
  }

  /**
   * Order endpoints by a set of rules, to ensure consistent registration and that precedence is honored
   */
  static orderEndpoints(endpoints: EndpointConfig[]): EndpointConfig[] {
    return endpoints
      .map(endpoint => {
        const parts = endpoint.path.replace(/^[/]|[/]$/g, '').split('/');
        return [endpoint, parts.map(part => /[*]/.test(part) ? 1 : /:/.test(part) ? 2 : 3)] as const;
      })
      .toSorted((a, b) => this.#compareEndpoints(a[1], b[1]) || a[0].path.localeCompare(b[0].path))
      .map(([endpoint,]) => endpoint);
  }


  /**
   * Order interceptors
   */
  static orderInterceptors(instances: WebInterceptor[]): WebInterceptor[] {
    const categoryList = WEB_INTERCEPTOR_CATEGORIES.map(category => ({
      key: category,
      start: castTo<Class<WebInterceptor>>({ name: `${category}Start` }),
      end: castTo<Class<WebInterceptor>>({ name: `${category}End` }),
    }));

    const categoryMapping = TypedObject.fromEntries(categoryList.map(category => [category.key, category]));

    const ordered = instances.map(category => {
      const group = categoryMapping[category.category];
      const after = [...category.dependsOn ?? [], group.start];
      const before = [...category.runsBefore ?? [], group.end];
      return ({ key: category.constructor, before, after, target: category, placeholder: false });
    });

    // Add category sets into the ordering
    let i = 0;
    for (const cat of categoryList) {
      const prevEnd = categoryList[i - 1]?.end ? [categoryList[i - 1].end] : [];
      ordered.push(
        { key: cat.start, before: [cat.end], after: prevEnd, placeholder: true, target: undefined! },
        { key: cat.end, before: [], after: [cat.start], placeholder: true, target: undefined! }
      );
      i += 1;
    }

    return WebCommonUtil.ordered(ordered)
      .filter(category => !category.placeholder)  // Drop out the placeholders
      .map(category => category.target);
  }
}