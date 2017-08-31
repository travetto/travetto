import { Class, Dependency, InjectableConfig } from '../types';
import { AppInfo } from "@encore/base";
import { DefinableHandler } from "./proxy";

export const DEFAULT_INSTANCE = '__default';

export interface ManagedExtra {
  postConstruct?: () => any
}

export class Registry {
  static injectables = new Map<string, InjectableConfig<any>>();
  static instances = new Map<string, Map<string, any>>();
  static proxies = new Map<string, Map<string, any>>();

  static aliases = new Map<string, Map<string, string>>();
  static byAnnotation = new Map<Function, Set<string>>();

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

    this.injectables.set(config.class.__id!, config);

    if (!this.aliases.has(config.target.__id!)) {
      this.aliases.set(config.target.__id!, new Map());
    }

    this.aliases.get(config.target.__id!)!.set(config.name, config.class.__id!);

    for (let anno of config.annotations) {
      if (!this.byAnnotation.has(anno)) {
        this.byAnnotation.set(anno, new Set());
      }
      this.byAnnotation.get(anno)!.add(config.class.__id!);
    }

    // Live RELOAD
    if (AppInfo.DEV_MODE &&
      this.proxies.has(config.target.__id!) &&
      this.proxies.get(config.target.__id!)!.has(config.name)
    ) {
      console.log('Updating target');
      let proxy: any = this.proxies.get(config.target.__id!)!.has(config.name);
      this.construct(config.target, config.name).then(res => proxy.target = res);
    }
  }

  static async construct<T>(target: Class<T & ManagedExtra>, name: string = DEFAULT_INSTANCE): Promise<T> {
    let clz = this.aliases.get(target.__id!)!.get(name)!;
    let managed = this.injectables.get(clz)!;

    const fieldKeys = Object.keys(managed.dependencies.fields!);

    const promises =
      managed.dependencies.cons
        .concat(fieldKeys.map(x => managed.dependencies.fields[x]))
        .map(x => this.getInstance(x.class, x.name));

    const allDeps = await Promise.all(promises);

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

  private static registerInstance<T>(target: Class<T>, instance: T, name: string = DEFAULT_INSTANCE) {
    if (!this.instances.has(target.__id!)) {
      this.instances.set(target.__id!, new Map());
      this.proxies.set(target.__id!, new Map());
    }

    let out: any = instance;

    if (AppInfo.DEV_MODE) {
      console.log('Registering proxy', target.name, name);
      let handler = new DefinableHandler(out);
      out = new Proxy({}, handler);
      this.proxies.get(target.__id!)!.set(name, handler);
    }

    this.instances.get(target.__id!)!.set(name, out);
  }

  static async getInstance<T>(target: Class<T>, name: string = DEFAULT_INSTANCE): Promise<T> {
    if (!this.instances.has(target.__id!) || !this.instances.get(target.__id!)!.has(name)) {
      let res = await this.construct(target, name);
      this.registerInstance(target, res, name);
    }
    return this.instances.get(target.__id!)!.get(name)!;
  }
}
