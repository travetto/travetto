import { Class, AppError } from '@travetto/base';
import { SchemaRegistry, SchemaValidator, ValidationResultError } from '@travetto/schema';

import { EndpointConfig } from '../registry/types';
import { ParamConfig, Request, Response } from '../types';

export type ExtractFn = (c: ParamConfig, req: Request, res: Response) => unknown;

/**
 * Parameter utils
 */
export class ParamUtil {
  static #typeExtractors = new Map<Class, ExtractFn>();

  /**
   * Default extractors
   */
  static defaultExtractors: Record<ParamConfig['location'], ExtractFn> = {
    path: (c, r) => r.params[c.name!],
    query: (c, r) => r.query[c.name!],
    header: (c, r) => r.header(c.name!),
    body: (__, r) => r.body,
    context: (c, req, res) => ParamUtil.getExtractor(c.contextType!)(c, req, res)
  };

  /**
   * Get the provider for a given input
   * @param type Class to check for
   * @param fn Extraction function
   */
  static provider(type: Class, fn: ExtractFn): Function;
  static provider(fnOrType: ExtractFn): Function;
  static provider(fnOrType: ExtractFn | Class, fn?: ExtractFn) {
    return (target: Class): void => this.registerContext(target, fnOrType, fn);
  }

  /**
   * Register a new context provider
   * @param finalType The class to check against
   * @param fnOrTypeOverride The Extraction class ofr type
   * @param fn Optional extraction function
   */
  static registerContext(finalType: Class, fnOrTypeOverride: ExtractFn | Class, fn?: ExtractFn): void {
    if (fn) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      this.#typeExtractors.set(fnOrTypeOverride as Class, fn);
    } else {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      this.#typeExtractors.set(finalType, fnOrTypeOverride as ExtractFn);
    }
  }

  /**
   * Get extractor for type
   * @param cls
   */
  static getExtractor(cls: Class): ExtractFn {
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
  static extractParams(route: EndpointConfig, req: Request, res: Response): unknown[] {
    const cls = route.class;
    const method = route.handlerName;
    const routed = route.params.map(c => (c.extract ?? this.defaultExtractors[c.location])(c, req, res));

    const params = SchemaRegistry.coerceMethodParams(cls, method, routed, true);

    try {
      SchemaValidator.validateMethod(cls, method, params);
    } catch (err) {
      if (err instanceof ValidationResultError) {
        for (const el of err.errors) {
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