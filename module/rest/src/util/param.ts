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
   * Get the provider for a given input
   * @param type Class to check for
   * @param fn Extraction function
   */
  static provider(type: Class, fn: ExtractFn): Function;
  static provider(fnOrType: ExtractFn): Function;
  static provider(fnOrType: ExtractFn | Class, fn?: ExtractFn) {
    return (target: Class) => this.registerContext(target, fnOrType, fn);
  }

  /**
   * Register a new context provider
   * @param finalType The class to check against
   * @param fnOrTypeOverride The Extraction class ofr type
   * @param fn Optional extraction function
   */
  static registerContext(finalType: Class, fnOrTypeOverride: ExtractFn | Class, fn?: ExtractFn) {
    if (fn) {
      finalType = fnOrTypeOverride as Class;
    } else {
      fn = fnOrTypeOverride as ExtractFn;
    }
    this.#typeExtractors.set(finalType, fn);
  }

  /**
   * Get extractor for type
   * @param cls
   */
  static getExtractor(cls: Class) {
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
  static extractParams(route: EndpointConfig, req: Request, res: Response) {
    const cls = route.class;
    const method = route.handlerName;
    const routed = route.params.map(c => c.extract(c, req, res));

    const params = SchemaRegistry.coereceMethodParams(cls, method, routed, true);

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