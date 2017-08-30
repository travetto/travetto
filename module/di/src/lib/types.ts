
export interface Class<T> {
  new(...args: any[]): T;
}

export interface InjectableConfig<T> extends Dependency<T> {
  target: Class<T>;
  dependencies: {
    cons: Dependency<any>[],
    fields: { [key: string]: Dependency<any> }
  };
  annotations: Function[];
}

export interface Dependency<T> {
  class: Class<T>;
  name: string;
}