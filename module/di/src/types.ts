export type ClassTarget<T> = Class<T> | (Function & { __filename?: string });

export interface Class<T> {
  new(...args: any[]): T;
  __filename?: string;
}

export interface InjectableConfig<T> extends Dependency<T> {
  class: Class<T>;
  dependencies: {
    cons: Dependency<any>[],
    fields: { [key: string]: Dependency<any> }
  };
  annotations: Function[];
}

export interface Dependency<T> {
  target: ClassTarget<T>;
  name: string;
  optional?: boolean;
}