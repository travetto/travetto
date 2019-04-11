import { ParamConfig } from '../types';
import { ControllerRegistry } from '../registry/registry';

export const Param = (param: ParamConfig) => {
  return (target: any, propertyKey: string | symbol, idx: number) => {
    const handler = target.prototype[propertyKey];
    ControllerRegistry.registerEndpointParameter(target.constructor, handler, param, idx);
  };
};

export const Path = (param: Partial<ParamConfig>) => {
  return Param({ type: String, location: 'path', required: true, ...(param as ParamConfig) });
};

export const Query = (param: Partial<ParamConfig>) => {
  return Param({ type: String, location: 'query', required: false, ...(param as ParamConfig) });
};

export const Header = (param: Partial<ParamConfig>) => {
  return Param({ type: String, location: 'header', required: false, ...(param as ParamConfig) });
};

export const Body = (param: Partial<ParamConfig>) => {
  return Param({ type: Object, location: 'body', required: true, ...(param as ParamConfig) });
};