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

const extractPath = (c: ParamConfig, r: Request) => r.params[c.name!];
const extractQuery = (c: ParamConfig, r: Request) => r.query[c.name!];
const extractHeader = (c: ParamConfig, r: Request) => r.header(c.name!);
const extractBody = (c: ParamConfig, r: Request) => r.body;

export const extractRequest = (c: ParamConfig, r: Request) => r;
export const extractResponse = (c: ParamConfig, r: Request, res: Response) => res;

export const Path = (param: string | Partial<ParamConfig> = {}) => Param({ location: 'path', extract: extractPath, ...toConfig(param) });
export const Query = (param: string | Partial<ParamConfig> = {}) => Param({ location: 'query', extract: extractQuery, ...toConfig(param) });
export const Header = (param: string | Partial<ParamConfig> = {}) => Param({ location: 'header', extract: extractHeader, ...toConfig(param), });
export const Body = (param: Partial<ParamConfig> = {}) => Param({ location: 'body', extract: extractBody, ...(param as ParamConfig) });