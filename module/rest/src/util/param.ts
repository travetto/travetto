import { Class, AppError } from '@travetto/runtime';
import { BindUtil, FieldConfig, SchemaRegistry, SchemaValidator, ValidationResultError } from '@travetto/schema';

import { EndpointConfig } from '../registry/types';
import { ParamConfig, Request, Response } from '../types';
import { MissingParamⲐ, RequestParamsⲐ } from '../internal/symbol';

export type ExtractFn = (c: ParamConfig, req: Request, res: Response, schema: FieldConfig) => unknown;

const QueryExpandedⲐ = Symbol.for('@travetto/rest:query-expanded');

declare global {
  interface TravettoRequest {
    [QueryExpandedⲐ]: Record<string, unknown>;
  }
}

function isClass(o: unknown): o is Class {
  return !!o && typeof o === 'function' && 'Ⲑid' in o;
}

/**
 * Parameter utils
 */
class $ParamExtractor {
  #typeExtractors = new Map<Class, ExtractFn>();

  /**
   * Default extractors
   */
  defaultExtractors: Record<ParamConfig['location'], ExtractFn>;

  constructor() {
    this.defaultExtractors = {
      path: (c, r): unknown => r.params[c.name!],
      query: (c, r, _, schema): unknown => {
        const exp = (r[QueryExpandedⲐ] ??= BindUtil.expandPaths(r.query));
        if (c.prefix) {
          return exp[c.prefix];
        } else if (schema.type.Ⲑid) { // Is a complex type
          return exp; // Return whole thing
        } else {
          return exp[c.name!];
        }
      },
      header: (c, r): unknown => r.header(c.name!),
      body: (__, r): unknown => r.body,
      context: (c, req, res, schema): unknown => this.getExtractor(c.contextType!)(c, req, res, schema)
    };
  }

  /**
   * Get the provider for a given input
   * @param type Class to check for
   * @param fn Extraction function
   */
  provider(type: Class, fn: ExtractFn): Function;
  provider(fnOrType: ExtractFn): Function;
  provider(fnOrType: ExtractFn | Class, fn?: ExtractFn) {
    return (target: Class): void => this.registerContext(target, fnOrType, fn);
  }

  /**
   * Register a new context provider
   * @param finalType The class to check against
   * @param fnOrTypeOverride The Extraction class ofr type
   * @param fn Optional extraction function
   */
  registerContext(finalType: Class, fnOrTypeOverride: ExtractFn | Class, fn?: ExtractFn): void {
    if (isClass(fnOrTypeOverride)) {
      this.#typeExtractors.set(fnOrTypeOverride, fn!);
    } else {
      this.#typeExtractors.set(finalType, fnOrTypeOverride);
    }
  }

  /**
   * Get extractor for type
   * @param cls
   */
  getExtractor(cls: Class): ExtractFn {
    const fn = this.#typeExtractors.get(cls);
    if (!fn) {
      throw new AppError(`Unknown context type: ${cls.name}`, 'data');
    }
    return fn;
  }

  /**
   * Extract all parameters for a given route/request/response combo
   * @param configs The list of all the params to extract
   * @param req The request
   * @param res The response
   */
  async extract(route: EndpointConfig, req: Request, res: Response): Promise<unknown[]> {
    const cls = route.class;
    const method = route.handlerName;

    const methodParams = SchemaRegistry.getMethodSchema(cls, method);
    const routed = route.params.map((c, i) =>
      (req[RequestParamsⲐ] && req[RequestParamsⲐ][i] !== MissingParamⲐ) ?
        req[RequestParamsⲐ][i] :
        (c.extract ?? this.defaultExtractors[c.location])(c, req, res, methodParams[i]));

    const params = BindUtil.coerceMethodParams(cls, method, routed);

    try {
      await SchemaValidator.validateMethod(cls, method, params, route.params.map(x => x.prefix));
    } catch (err) {
      if (err instanceof ValidationResultError) {
        for (const el of err.details.errors) {
          if (el.kind === 'required') {
            const config = route.params.find(x => x.name === el.path);
            if (config) {
              el.message = `Missing ${config.location.replace(/s$/, '')}: ${config.name}`;
            }
          }
        }
      }
      throw err;
    }
    return params;
  }
}

export const ParamExtractor = new $ParamExtractor();