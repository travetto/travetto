import { Class } from '@travetto/registry';
import { Filter, HeaderMap, RouteConfig, RouteHandler } from '../types';

export interface EndpointClassType {
  type: Class;
  wrapper?: Class;
  description?: string;
}

export interface EndpointSimpleType {
  mime: string;
  type: string;
}

export type EndpointIOType = EndpointClassType | EndpointSimpleType;

export interface DescribableConfig {
  title?: string;
  description?: string;
}

interface CoreConfig {
  class: Class;
  instance?: any;

  filters: Filter[];
  headers: HeaderMap;
}

export interface EndpointConfig extends RouteConfig, CoreConfig, DescribableConfig {
  id: string;
  priority: number;
  handlerName: string;
  responseType?: EndpointIOType;
  requestType?: EndpointIOType;
}

export interface ControllerConfig extends CoreConfig, DescribableConfig {
  basePath: string;
  endpoints: EndpointConfig[];
}

export interface EndpointDecorator<T = any> {
  (target: any, prop: string | symbol, descriptor: TypedPropertyDescriptor<RouteHandler<T>>): TypedPropertyDescriptor<RouteHandler<T>> | undefined;
}

export interface ControllerDecorator<T = any> {
  (target: Class<T>): Class<T> | undefined;
}