import { ParamConfig, Request, Response } from '../types';
import { ControllerRegistry } from '../registry/registry';
import { ParamUtil, ExtractFn } from '../util/param';

const EXTRACTORS: Record<ParamConfig['location'], ExtractFn> = {
  path: (c, r) => ParamUtil.convertValue(c, r.params[c.name!]),
  query: (c, r) => ParamUtil.convertValue(c, r.query[c.name!]),
  header: (c, r) => ParamUtil.convertValue(c, r.header(c.name!)),
  body: (__, r) => r.body,
  context: ParamUtil.extractContext.bind(ParamUtil)
};

export const paramConfig = (location: ParamConfig['location'], extra: string | Partial<ParamConfig>) => ({
  type: String,
  location, extract: EXTRACTORS[location]!, ...(
    (typeof extra === 'string' ? { name: extra } : extra)
  )
}) as ParamConfig;

// TODO: Document
export const Param = (location: ParamConfig['location'], extra: string | Partial<ParamConfig>) => {
  const param = paramConfig(location, extra);
  return (target: any, propertyKey: string | symbol, idx: number) => {
    const handler = target.constructor.prototype[propertyKey];
    ControllerRegistry.registerEndpointParameter(target.constructor, handler, param, idx);
  };
};

/** @augments trv/rest/Param */
export const Context = (param: string | Partial<ParamConfig> = {}) => Param('context', param);
/** @augments trv/rest/Param */
export const Path = (param: string | Partial<ParamConfig> = {}) => Param('path', param);
/** @augments trv/rest/Param */
export const Query = (param: string | Partial<ParamConfig> = {}) => Param('query', param);
/** @augments trv/rest/Param */
export const Header = (param: string | Partial<ParamConfig> = {}) => Param('header', param);
/** @augments trv/rest/Param */
export const Body = (param: Partial<ParamConfig> = {}) => Param('body', param);

// TODO: Document
export const ContextProvider = ParamUtil.provider.bind(ParamUtil);
@ContextProvider((__: any, rq: Request) => rq) export class REQUEST { }
@ContextProvider((__: any, rq: Request, rs: Response) => rs) export class RESPONSE { }
