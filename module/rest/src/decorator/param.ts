import { AppError } from '@travetto/base';
import { Class } from '@travetto/registry';
import { ParamConfig, Request, Response } from '../types';
import { ControllerRegistry } from '../registry/registry';

function toConfig(param: string | Partial<ParamConfig>) {
  if (typeof param === 'string') {
    param = { name: param };
  }
  return param as ParamConfig;
}

export const Param = (param: ParamConfig) => {
  return (target: any, propertyKey: string | symbol, idx: number) => {
    const handler = target.constructor.prototype[propertyKey];
    ControllerRegistry.registerEndpointParameter(target.constructor, handler, param, idx);
  };
};

type ExtractFn = (c: ParamConfig, req?: Request, res?: Response) => any;
const ContextParamRegistry = new Map<Class<any>, ExtractFn>();

export function ContextProvider(type: Class, fn: ExtractFn): Function;
export function ContextProvider(fnOrType: ExtractFn): Function;
export function ContextProvider(fnOrType: ExtractFn | Class, fn?: ExtractFn) {
  return (target: any) => {
    let finalType = target;
    if (fn) {
      finalType = fnOrType as Class;
    } else {
      fn = fnOrType as ExtractFn;
    }
    ContextParamRegistry.set(finalType, fn);
  };
}

@ContextProvider((c: any, req: any) => req)
export class REQUEST { }
@ContextProvider((c: any, req: any, res: any) => res)
export class RESPONSE { }

const extractPath = (c: ParamConfig, r: Request) => r.params[c.name!];
const extractQuery = (c: ParamConfig, r: Request) => r.query[c.name!];
const extractHeader = (c: ParamConfig, r: Request) => r.header(c.name!);
const extractBody = (c: ParamConfig, r: Request) => r.body;
const extractContext = (c: ParamConfig, req: Request, res: Response) => {
  const fn = ContextParamRegistry.get(c.type);
  if (!fn) {
    throw new AppError(`Unknown context type: ${c.type.name}`, 'data');
  }
  return fn(c, req, res);
};

export const Context = (param: string | Partial<ParamConfig> = {}) => Param({ location: 'context', extract: extractContext, ...toConfig(param) });
export const Path = (param: string | Partial<ParamConfig> = {}) => Param({ location: 'path', extract: extractPath, ...toConfig(param) });
export const Query = (param: string | Partial<ParamConfig> = {}) => Param({ location: 'query', extract: extractQuery, ...toConfig(param) });
export const Header = (param: string | Partial<ParamConfig> = {}) => Param({ location: 'header', extract: extractHeader, ...toConfig(param), });
export const Body = (param: Partial<ParamConfig> = {}) => Param({ location: 'body', extract: extractBody, ...(param as ParamConfig) });