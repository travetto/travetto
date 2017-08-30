import { Class } from '../types';

export const DEFAULT_INSTANCE = '__default';

export interface InjectableExtra {
  postConstruct?: () => any
}
export interface InjectableConfig<T> extends Dependency<T> {
  target?: Class<T>,
  dependencies?: any[],
  annotations?: Function[]
}

export interface Dependency<T> {
  class: Class<T>
  name?: string;
}

export class Registry {
  static injectables = new Map<Class<any>, Map<string, Class<any>>>();
  static instances = new Map<Class<any>, Map<string, any>>();
  static dependencies = new Map<Class<any>, Array<Dependency<any>>>();
  static byAnnotation = new Map<Function, Set<Class<any>>>();

  private static registerInstance<T>(cls: Class<T>, instance: T, name: string = DEFAULT_INSTANCE) {
    if (!this.instances.has(cls)) {
      this.instances.set(cls, new Map());
    }
    this.instances.get(cls)!.set(name, instance);
  }

  static register<T>(config: InjectableConfig<T>) {
    config.name = config.name || DEFAULT_INSTANCE;

    if (!this.injectables.has(config.class)) {
      this.injectables.set(config.class, new Map());
    }
    for (let dep of (config.dependencies || [])) {
      if (!dep.name) {
        dep.name = DEFAULT_INSTANCE;
      }
    }
    this.injectables.get(config.target || config.class)!.set(config.name, config.class);
    this.dependencies.set(config.class, (config.dependencies || []).slice(0));

    for (let anno of (config.annotations || [])) {
      if (!this.byAnnotation.has(anno)) {
        this.byAnnotation.set(anno, new Set());
      }
      this.byAnnotation.get(anno)!.add(config.class);
    }
  }

  static async construct<T>(cls: Class<T & InjectableExtra>, name: string = DEFAULT_INSTANCE): Promise<T> {
    let deps = (this.dependencies.get(cls)! || [])
      .map(x => this.getInstance(x.class, x.name));
    let inst = new cls(...(await Promise.all(deps)));
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
