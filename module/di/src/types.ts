import { Class } from '@travetto/registry';

export type ClassTarget<T> = Class<T> | Function;

export interface InjectableConfig<T = any> extends Dependency<T> {
  class: Class<T>;
  factory: (...args: any[]) => T;
  dependencies: {
    cons?: Dependency<any>[],
    fields: { [key: string]: Dependency<any> }
  };
  autoCreate: { priority?: number, create: boolean }
}

export interface Dependency<T = any> {
  target: ClassTarget<T>;
  qualifier: symbol;
  optional?: boolean;
  original?: Symbol | object;
}

export interface InjectableFactoryConfig<T> {
  class: Class<T>;
  qualifier?: symbol;
  dependencies?: Dependency<any>[]
  autoCreate?: boolean
  original?: Symbol | object;
}