import { Class, AppError, Util } from '@travetto/base';

import { ParamConfig, Request, Response } from '../types';

export type ExtractFn = (c: ParamConfig, req: Request, res: Response) => unknown;

/**
 * Parameter utils
 */
export class ParamUtil {
  static CONTEXT_REGISTRY = new Map<Class, ExtractFn>();

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
    this.CONTEXT_REGISTRY.set(finalType, fn);
  }

  /**
   * Extract param context via param type
   * @param c The param configuration
   * @param req The request
   * @param res The response
   */
  static extractContext(c: ParamConfig, req: Request, res: Response) {
    const fn = this.CONTEXT_REGISTRY.get(c.type);
    if (!fn) {
      throw new AppError(`Unknown context type: ${c.type.name}`, 'data');
    }
    return fn(c, req, res);
  }

  /**
   * Convert an inbound value against the parameter config
   * @param config The param config
   * @param paramValue The value provided
   */
  static convertValue(config: ParamConfig, paramValue: unknown) {
    if (paramValue !== undefined && paramValue !== null) {
      try {
        if (config.array) {
          if (!Array.isArray(paramValue)) {
            paramValue = [paramValue];
          }
          paramValue = (paramValue as unknown[]).map(x => Util.coerceType(x, config.type));
        } else {
          paramValue = Util.coerceType(paramValue, config.type);
        }
      } catch (e) {
        throw new AppError(`Incorrect type for ${config.location} param ${config.name}, ${paramValue} is not a ${config.type!.name}`, 'data');
      }
    }
    return paramValue;
  }

  /**
   * Extract all parameters for a given route/request/response combo
   * @param configs The list of all the params to extract
   * @param req The request
   * @param res The response
   */
  static extractParams(configs: ParamConfig[], req: Request, res: Response) {
    const params: unknown[] = [];
    for (const config of configs) {
      let paramValue = config.extract(config, req, res);
      if (paramValue === undefined) {
        if (config.required && config.defaultValue === undefined) {
          throw new AppError(`Missing ${config.location.replace(/s$/, '')}: ${config.name}`, 'data');
        } else {
          paramValue = config.defaultValue;
        }
      }
      params.push(paramValue);
    }
    return params;
  }
}