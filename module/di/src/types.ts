import { Class } from '@travetto/registry';

export type ClassTarget<T> = Class<T> | Function;

export interface Dependency<T = any> {
  target: ClassTarget<T>;
  qualifier: symbol;
  optional?: boolean;
  original?: Symbol | object;
}

export interface InjectableConfig<T = any> extends Dependency<T> {
  class: Class<T>;
  factory: (...args: any[]) => T;
  dependencies: {
    cons?: Dependency<any>[],
    fields: { [key: string]: Dependency<any> }
  };
}

export interface InjectableFactoryConfig<T> {
  class: Class<T>;
  src: Class<T>;
  qualifier?: symbol;
  dependencies?: Dependency<any>[];
  original?: Symbol | object;
}

export interface Runnable {
  run(): any;
}

export interface ApplicationParameter {
  name: string;
  title?: string;
  type?: string;
  subtype?: string;
  meta?: any;
  def?: string;
}

export interface ApplicationConfig<T = any> {
  name: string;
  description?: string;
  params?: ApplicationParameter[];
  target: Class<T>;
  watchable?: boolean;
}