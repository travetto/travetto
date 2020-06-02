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

/**
 * Get the param configuration
 * @param location The location of the parameter
 * @param extra Any additional configuration for the param config
 */
export const paramConfig = (location: ParamConfig['location'], extra: string | Partial<ParamConfig>) => ({
  type: String,
  location, extract: EXTRACTORS[location]!, ...(
    (typeof extra === 'string' ? { name: extra } : extra)
  )
}) as ParamConfig;

/**
 * Define a parameter
 * @param location The location of the parameter
 * @param extra Any extra configuration for the param
 */
export const Param = (location: ParamConfig['location'], extra: string | Partial<ParamConfig>) => {
  const param = paramConfig(location, extra);
  return (target: any, propertyKey: string | symbol, idx: number) => {
    const handler = target.constructor.prototype[propertyKey];
    ControllerRegistry.registerEndpointParameter(target.constructor, handler, param, idx);
  };
};

/**
 * Define a Context param
 * @param param The parma configuration or name
 * @augments `@trv:rest/Param`
 */
export const Context = (param: string | Partial<ParamConfig> = {}) => Param('context', param);
/**
 * Define a Path param
 * @param param The parma configuration or name
 * @augments `@trv:rest/Param`
 */
export const Path = (param: string | Partial<ParamConfig> = {}) => Param('path', param);
/**
 * Define a Query param
 * @param param The parma configuration or name
 * @augments `@trv:rest/Param`
 */
export const Query = (param: string | Partial<ParamConfig> = {}) => Param('query', param);
/**
 * Define a Header param
 * @param param The parma configuration or name
 * @augments `@trv:rest/Param`
 */
export const Header = (param: string | Partial<ParamConfig> = {}) => Param('header', param);
/**
 * Define a body param as an input
 * @param param The parma configuration
 * @augments `@trv:rest/Param`
 */
export const Body = (param: Partial<ParamConfig> = {}) => Param('body', param);

/**
 * Create context provider as a decorator, to allow for adding additional context parameter values
 */
export const ContextProvider = ParamUtil.provider.bind(ParamUtil);
@ContextProvider((__: any, rq: Request) => rq) export class REQUEST { }
@ContextProvider((__: any, rq: Request, rs: Response) => rs) export class RESPONSE { }
