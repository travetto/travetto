import { Class, Dependency, InjectableConfig } from '../types';

export const DEFAULT_INSTANCE = '__default';

export interface InjectableExtra {
  postConstruct?: () => any
}

export class Registry {
  static managed = new Map<Class<any>, Map<string, InjectableConfig<any>>>();
  static instances = new Map<Class<any>, Map<string, any>>();
  static byAnnotation = new Map<Function, Set<Class<any>>>();

  private static registerInstance<T>(cls: Class<T>, instance: T, name: string = DEFAULT_INSTANCE) {
    if (!this.instances.has(cls)) {
      this.instances.set(cls, new Map());
    }
    this.instances.get(cls)!.set(name, instance);
  }

  static register<T>(pconfig: Partial<InjectableConfig<T>>) {
    pconfig.name = pconfig.name || DEFAULT_INSTANCE;
    pconfig.dependencies = pconfig.dependencies || {} as any;
    pconfig.target = pconfig.target || pconfig.class;

    const config = pconfig as InjectableConfig<T>;

    if (!this.managed.has(config.class)) {
      this.managed.set(config.class, new Map());
    }
    config.dependencies.cons = config.dependencies.cons || [];
    config.dependencies.fields = config.dependencies.fields || {};

    for (let dep of config.dependencies.cons) {
      dep.name = dep.name || DEFAULT_INSTANCE;
    }

    for (let key of Object.keys(config.dependencies.fields)) {
      let obj = config.dependencies.fields[key];
      obj.name = obj.name || DEFAULT_INSTANCE;
    }

    this.managed.get(config.target)!.set(config.name, config);

    for (let anno of config.annotations) {
      if (!this.byAnnotation.has(anno)) {
        this.byAnnotation.set(anno, new Set());
      }
      this.byAnnotation.get(anno)!.add(config.class);
    }
  }

  static async construct<T>(cls: Class<T & InjectableExtra>, name: string = DEFAULT_INSTANCE): Promise<T> {
    let managed = this.managed.get(cls)!.get(name)!;

    const consPromises = managed.dependencies.cons
      .map(x => this.getInstance(x.class, x.name));

    const fieldKeys = Object.keys(managed.dependencies.fields!);
    const fieldPromises = fieldKeys
      .map(x => managed.dependencies.fields[x])
      .map(x => this.getInstance(x.class, x.name));

    const allDeps = await Promise.all(consPromises.concat(fieldPromises));

    const consValues = allDeps.slice(0, managed.dependencies.cons.length);
    const fieldValues = allDeps.slice(managed.dependencies.cons.length);

    const inst = new cls(...consValues);

    for (let i = 0; i < fieldKeys.length; i++) {
      (inst as any)[fieldKeys[i]] = fieldValues[i];
    }

    if (inst.postConstruct) {
      await inst.postConstruct();
    }
    return inst;
  }

  static async getInstance<T>(cls: Class<T>, name: string = DEFAULT_INSTANCE): Promise<T> {
    if (!this.instances.has(cls)) {
      this.instances.set(cls, new Map());
    }
    if (!this.instances.get(cls)!.has(name)) {
      let res = await this.construct(cls, name);
      this.instances.get(cls)!.set(name, res);
    }
    return this.instances.get(cls)!.get(name)!;
  }
}
