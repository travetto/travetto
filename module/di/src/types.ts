import { Class } from '@travetto/registry';

export type ClassTarget<T> = Class<T> | Function;

export interface Dependency<T = any> {
  target: ClassTarget<T>;
  qualifier: symbol;
  optional?: boolean;
  defaultIfMissing?: ClassTarget<T>;
  original?: symbol | object;
}

export interface InjectableConfig<T = any> extends Dependency<T> {
  class: Class<T>;
  factory: (...args: any[]) => T;
  dependencies: {
    cons?: Dependency<any>[];
    fields: Record<string, Dependency<any>>;
  };
}

export interface InjectableFactoryConfig<T> {
  target: Class<T>;
  src: Class<T>;
  qualifier?: symbol;
  dependencies?: Dependency<any>[];
  original?: symbol | object;
}