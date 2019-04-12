import { ParamConfig, Request } from '../types';
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

const pathExtract = (c: ParamConfig, r: Request) => r.params[c.name!];
const queryExtract = (c: ParamConfig, r: Request) => r.query[c.name!];
const headerExtract = (c: ParamConfig, r: Request) => r.header(c.name!);
const bodyExtract = (c: ParamConfig, r: Request) => r.body;

export const Path = (param: string | Partial<ParamConfig> = {}) => Param({ location: 'path', extract: pathExtract, ...toConfig(param) });
export const Query = (param: string | Partial<ParamConfig> = {}) => Param({ location: 'query', extract: queryExtract, ...toConfig(param) });
export const Header = (param: string | Partial<ParamConfig> = {}) => Param({ location: 'header', extract: headerExtract, ...toConfig(param), });
export const Body = (param: Partial<ParamConfig> = {}) => Param({ location: 'body', extract: bodyExtract, ...(param as ParamConfig) });