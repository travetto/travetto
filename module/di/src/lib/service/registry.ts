import { Class } from '../types';

export const DEFAULT_INSTANCE = '__default';

export interface Dependency {
  name: string;
  type: Class<any>
}

export class Registry {
  static providers = new Map<Class<any>, Map<string, Class<any>>>();
  static classesByAnnotation = new Map<Function, Set<Class<any>>>();
  static instances = new Map<Class<any>, Map<string, any>>();
  static dependencies = new Map<Class<any>, Array<Dependency>>();

  private static registerFullInstance<T>(cls: Class<T>, instance: T, name: string = DEFAULT_INSTANCE) {
    if (!this.instances.has(cls)) {
      this.instances.set(cls, new Map());
    }
    this.instances.get(cls)!.set(name, instance);
  }

  static registerProvider<T>(cls: Class<T>, target: Class<T> = cls, name: string = DEFAULT_INSTANCE, dependencies: Dependency[] = []) {
    if (!this.providers.has(target)) {
      this.providers.set(target, new Map());
    }
    for (let dep of dependencies) {
      if (!dep.name) {
        dep.name = DEFAULT_INSTANCE;
      }
    }
    this.providers.get(target)!.set(name, cls);
    this.dependencies.set(cls, dependencies.slice(0));
  }

  static construct<T>(cls: Class<T>, name: string = DEFAULT_INSTANCE): T {
    let deps = (this.dependencies.get(cls)! || [])
      .map(x => this.getInstance(x.type, x.name));
    let inst = new cls(...deps);
    return inst;
  }

  static getInstance<T>(cls: Class<T>, name: string = DEFAULT_INSTANCE): T {
    if (!this.instances.has(cls)) {
      this.instances.set(cls, new Map());
    }
    if (!this.instances.get(cls)!.has(name)) {
      this.instances.get(cls)!.set(name, this.construct(cls, name));
    }
    return this.instances.get(cls)!.get(name)!;
  }
}
