import { AppError, Util } from '@travetto/base';
import { Class } from '@travetto/registry';

import { ParamConfig, Request, Response } from '../types';

export type ExtractFn = (c: ParamConfig, req: Request, res: Response) => any;

// TODO: Document
export class ParamUtil {
  static CONTEXT_REGISTRY = new Map<Class<any>, ExtractFn>();

  static provider(type: Class, fn: ExtractFn): Function;
  static provider(fnOrType: ExtractFn): Function;
  static provider(fnOrType: ExtractFn | Class, fn?: ExtractFn) {
    return (target: any) => this.registerContext(target, fnOrType, fn);
  }

  static registerContext(finalType: Class, fnOrTypeOverride: ExtractFn | Class, fn?: ExtractFn) {
    if (fn) {
      finalType = fnOrTypeOverride as Class;
    } else {
      fn = fnOrTypeOverride as ExtractFn;
    }
    this.CONTEXT_REGISTRY.set(finalType, fn);
  }

  static extractContext(c: ParamConfig, req: Request, res: Response) {
    const fn = this.CONTEXT_REGISTRY.get(c.type);
    if (!fn) {
      throw new AppError(`Unknown context type: ${c.type.name}`, 'data');
    }
    return fn(c, req, res);
  }

  static convertValue(config: ParamConfig, paramValue: any) {
    if (paramValue !== undefined && paramValue !== null) {
      try {
        if (config.array) {
          if (!Array.isArray(paramValue)) {
            paramValue = [paramValue];
          }
          paramValue = paramValue.map((x: any) => Util.coerceType(x, config.type));
        } else {
          paramValue = Util.coerceType(paramValue, config.type);
        }
      } catch (e) {
        throw new AppError(`Incorrect type for ${config.location} param ${config.name}, ${paramValue} is not a ${config.type!.name}`, 'data');
      }
    }
    return paramValue;
  }

  static extractParams(configs: ParamConfig[], req: Request, res: Response) {
    const params: any[] = [];
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