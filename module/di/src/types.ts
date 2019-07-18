import { Class } from '@travetto/registry';

export type ClassTarget<T> = Class<T> | Function;

export interface Dependency<T = any> {
  target: ClassTarget<T>;
  qualifier: symbol;
  optional?: boolean;
  defaultIfMissing?: ClassTarget<T>;
  original?: Symbol | object;
}

export interface InjectableConfig<T = any> extends Dependency<T> {
  class: Class<T>;
  factory: (...args: any[]) => T;
  dependencies: {
    cons?: Dependency<any>[],
    fields: Record<string, Dependency<any>>
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
  meta?: {
    choices: string[];
    [key: string]: any;
  };
  def?: string;
  optional?: boolean;
}

export interface ApplicationConfig<T = any> {
  name: string;
  description?: string;
  standalone?: boolean;
  params?: ApplicationParameter[];
  target: Class<T>;
  watchable?: boolean;
}