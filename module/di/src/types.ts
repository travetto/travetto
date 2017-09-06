export type ClassTarget<T> = Class<T> | (Function & { __filename?: string, __id?: string });

export interface Class<T = any> {
  new(...args: any[]): T;
  __filename?: string;
  __id?: string;
}

export interface InjectableConfig<T> extends Dependency<T> {
  class: Class<T>;
  dependencies: {
    cons?: Dependency<any>[],
    fields: { [key: string]: Dependency<any> }
  };
  autoCreate: { priority?: number, create: boolean }
}

export interface Dependency<T = any> {
  target: ClassTarget<T>;
  name: string;
  optional?: boolean;
}