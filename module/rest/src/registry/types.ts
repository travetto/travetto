import { Class } from '@travetto/registry';
import { Filter, HeaderMap, RouteConfig, FilterNone, FilterReq } from '../types';

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

export interface ParamConfig {
  name: string;
  description?: string;
  required?: boolean;
  location: 'path' | 'query' | 'body';
  type?: Class;
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
  params: { [key: string]: ParamConfig };
  responseType?: EndpointIOType;
  requestType?: EndpointIOType;
}

export interface ControllerConfig extends CoreConfig, DescribableConfig {
  basePath: string;
  endpoints: EndpointConfig[];
}

export interface EndpointDecorator<T = any> {
  (target: any, prop: string | symbol, descriptor: TypedPropertyDescriptor<FilterNone<T>>): TypedPropertyDescriptor<FilterNone<T>> | undefined;
  (target: any, prop: string | symbol, descriptor: TypedPropertyDescriptor<FilterReq<T>>): TypedPropertyDescriptor<FilterReq<T>> | undefined;
  (target: any, prop: string | symbol, descriptor: TypedPropertyDescriptor<Filter<T>>): TypedPropertyDescriptor<Filter<T>> | undefined;
}

export interface ControllerDecorator<T = any> {
  (target: Class<T>): Class<T> | undefined;
}