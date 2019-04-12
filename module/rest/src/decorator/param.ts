import { ParamConfig } from '../types';
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

export const Path = (param: string | Partial<ParamConfig> = {}) => Param({ location: 'path', ...toConfig(param) });
export const Query = (param: string | Partial<ParamConfig> = {}) => Param({ location: 'query', ...toConfig(param) });
export const Header = (param: string | Partial<ParamConfig> = {}) => Param({ location: 'header', ...toConfig(param) });
export const Body = (param: Partial<ParamConfig> = {}) => Param({ location: 'body', ...(param as ParamConfig) });