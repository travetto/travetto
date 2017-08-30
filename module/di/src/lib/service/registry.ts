import { Class, Dependency, InjectableConfig } from '../types';

export const DEFAULT_INSTANCE = '__default';

export interface ManagedExtra {
  postConstruct?: () => any
}

export class Registry {
  static injectables = new Map<Class<any>, InjectableConfig<any>>();
  static instances = new Map<Class<any>, Map<string, any>>();

  static aliases = new Map<Class<any>, Map<string, Class<any>>>();
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
    pconfig.annotations = pconfig.annotations || [];

    const config = pconfig as InjectableConfig<T>;
    config.dependencies.cons = config.dependencies.cons || [];
    config.dependencies.fields = config.dependencies.fields || {};

    for (let dep of config.dependencies.cons) {
      dep.name = dep.name || DEFAULT_INSTANCE;
    }

    for (let key of Object.keys(config.dependencies.fields)) {
      let obj = config.dependencies.fields[key];
      obj.name = obj.name || DEFAULT_INSTANCE;
    }

    this.injectables.set(config.class, config);

    if (!this.aliases.has(config.target)) {
      this.aliases.set(config.target, new Map());
    }

    this.aliases.get(config.target)!.set(config.name, config.class);

    for (let anno of config.annotations) {
      if (!this.byAnnotation.has(anno)) {
        this.byAnnotation.set(anno, new Set());
      }
      this.byAnnotation.get(anno)!.add(config.class);
    }
  }

  static async construct<T>(target: Class<T & ManagedExtra>, name: string = DEFAULT_INSTANCE): Promise<T> {
    let clz = this.aliases.get(target)!.get(name)!;
    let managed = this.injectables.get(clz)!;

    console.log("Getting", target, clz, name, managed);

    const consPromises = managed.dependencies.cons
      .map(x => this.getInstance(x.class, x.name));

    const fieldKeys = Object.keys(managed.dependencies.fields!);
    const fieldPromises = fieldKeys
      .map(x => managed.dependencies.fields[x])
      .map(x => this.getInstance(x.class, x.name));

    const allDeps = await Promise.all(consPromises.concat(fieldPromises));

    const consValues = allDeps.slice(0, managed.dependencies.cons.length);
    const fieldValues = allDeps.slice(managed.dependencies.cons.length);

    const inst = new managed.class(...consValues);

    for (let i = 0; i < fieldKeys.length; i++) {
      (inst as any)[fieldKeys[i]] = fieldValues[i];
    }

    if (inst.postConstruct) {
      await inst.postConstruct();
    }
    return inst;
  }

  static async getInstance<T>(target: Class<T>, name: string = DEFAULT_INSTANCE): Promise<T> {
    if (!this.instances.has(target)) {
      this.instances.set(target, new Map());
    }
    if (!this.instances.get(target)!.has(name)) {
      let res = await this.construct(target, name);
      this.instances.get(target)!.set(name, res);
    }
    return this.instances.get(target)!.get(name)!;
  }
}
