import { ParamConfig, Request, Response } from '../types';
import { ControllerRegistry } from '../registry/registry';
import { ParamUtil, ExtractFn } from '../util/param';


const EXTRACTORS: Record<ParamConfig['location'], ExtractFn> = {
  path: (c, r) => ParamUtil.convertValue(c, r.params[c.name!]),
  query: (c, r) => ParamUtil.convertValue(c, r.query[c.name!]),
  header: (c, r) => ParamUtil.convertValue(c, r.header(c.name!)),
  body: (_, r) => r.body,
  context: ParamUtil.extractContext.bind(ParamUtil)
};

export const paramConfig = (location: ParamConfig['location'], extra: string | Partial<ParamConfig>) => ({
  type: String,
  location, extract: EXTRACTORS[location]!, ...(
    (typeof extra === 'string' ? { name: extra } : extra)
  )
}) as ParamConfig;

export const Param = (location: ParamConfig['location'], extra: string | Partial<ParamConfig>) => {
  const param = paramConfig(location, extra);
  return (target: any, propertyKey: string | symbol, idx: number) => {
    const handler = target.constructor.prototype[propertyKey];
    ControllerRegistry.registerEndpointParameter(target.constructor, handler, param, idx);
  };
};

export const Context = (param: string | Partial<ParamConfig> = {}) => Param('context', param);
export const Path = (param: string | Partial<ParamConfig> = {}) => Param('path', param);
export const Query = (param: string | Partial<ParamConfig> = {}) => Param('query', param);
export const Header = (param: string | Partial<ParamConfig> = {}) => Param('header', param);
export const Body = (param: Partial<ParamConfig> = {}) => Param('body', param);

export const ContextProvider = ParamUtil.provider.bind(ParamUtil);
@ContextProvider((_: any, rq: Request) => rq) export class REQUEST { }
@ContextProvider((_: any, rq: Request, rs: Response) => rs) export class RESPONSE { }
