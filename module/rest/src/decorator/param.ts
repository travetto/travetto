import { ParamConfig, Request, Response } from '../types';
import { ControllerRegistry } from '../registry/registry';
import { ParamUtil, ExtractFn } from '../util/param';

export const Param = (param: ParamConfig) => {
  return (target: any, propertyKey: string | symbol, idx: number) => {
    const handler = target.constructor.prototype[propertyKey];
    ControllerRegistry.registerEndpointParameter(target.constructor, handler, param, idx);
  };
};

const extractPath: ExtractFn = (c, r) => ParamUtil.convertValue(c, r.params[c.name!]);
const extractQuery: ExtractFn = (c, r) => ParamUtil.convertValue(c, r.query[c.name!]);
const extractHeader: ExtractFn = (c, r) => ParamUtil.convertValue(c, r.header(c.name!));
const extractBody: ExtractFn = (_, r) => r.body;
const extractContext: ExtractFn = ParamUtil.extractContext.bind(ParamUtil);

const toConfig = (param: string | Partial<ParamConfig>) => (typeof param === 'string' ? { name: param } : param) as ParamConfig;
export const Context = (param: string | Partial<ParamConfig> = {}) => Param({ location: 'context', extract: extractContext, ...toConfig(param) });
export const Path = (param: string | Partial<ParamConfig> = {}) => Param({ location: 'path', extract: extractPath, ...toConfig(param) });
export const Query = (param: string | Partial<ParamConfig> = {}) => Param({ location: 'query', extract: extractQuery, ...toConfig(param) });
export const Header = (param: string | Partial<ParamConfig> = {}) => Param({ location: 'header', extract: extractHeader, ...toConfig(param), });
export const Body = (param: Partial<ParamConfig> = {}) => Param({ location: 'body', extract: extractBody, ...toConfig(param) });

export const ContextProvider = ParamUtil.provider.bind(ParamUtil);
@ContextProvider((_: any, rq: Request) => rq) export class REQUEST { }
@ContextProvider((_: any, rq: Request, rs: Response) => rs) export class RESPONSE { }
