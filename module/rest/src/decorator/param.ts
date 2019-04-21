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

export const REQUEST = class { };
export const RESPONSE = class { };

export const ContextParamRegistry = new Map<Class<any>, (c: ParamConfig, req?: Request, res?: Response) => any>([
  [REQUEST, (c: any, req: any) => req],
  [RESPONSE, (c: any, req: any, res: any) => res]
]);

const extractPath = (c: ParamConfig, r: Request) => r.params[c.name!];
const extractQuery = (c: ParamConfig, r: Request) => r.query[c.name!];
const extractHeader = (c: ParamConfig, r: Request) => r.header(c.name!);
const extractBody = (c: ParamConfig, r: Request) => r.body;
const extractContext = (c: ParamConfig, req: Request, res: Response) => ContextParamRegistry.get(c.type)!(c, req, res);

export const Context = (param: string | Partial<ParamConfig> = {}) => Param({ location: 'context', extract: extractContext, ...toConfig(param) });
export const Path = (param: string | Partial<ParamConfig> = {}) => Param({ location: 'path', extract: extractPath, ...toConfig(param) });
export const Query = (param: string | Partial<ParamConfig> = {}) => Param({ location: 'query', extract: extractQuery, ...toConfig(param) });
export const Header = (param: string | Partial<ParamConfig> = {}) => Param({ location: 'header', extract: extractHeader, ...toConfig(param), });
export const Body = (param: Partial<ParamConfig> = {}) => Param({ location: 'body', extract: extractBody, ...(param as ParamConfig) });