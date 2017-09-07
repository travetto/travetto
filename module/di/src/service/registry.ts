import * as path from 'path';

import { Dependency, InjectableConfig, ClassTarget } from '../types';
import { InjectionError } from './error';
import { MetadataRegistry, Class, RootRegistry } from '@encore2/registry';
import { AppEnv } from '@encore2/base';
import { RetargettingHandler } from '@encore2/compiler';

export const DEFAULT_INSTANCE = '__default';

export interface ManagedExtra {
  postConstruct?: () => any
}

type TargetId = string;
type ClassId = string;

export class $DependencyRegistry extends MetadataRegistry<InjectableConfig> {
  private pendingFinalize: Class[] = [];

  private instances = new Map<TargetId, Map<string, any>>();
  private proxyHandlers = new Map<TargetId, Map<string, any>>();
  private aliases = new Map<TargetId, Map<string, string>>();

  private autoCreate: (Dependency<any> & { priority: number })[] = [];

  constructor() {
    super(RootRegistry);
  }

  async init() {
    await RootRegistry.initialize();

    let finalizing = this.pendingFinalize;
    this.pendingFinalize = [];
    for (let cls of finalizing) {
      this.onRegister(cls);
    }

    // this.initalized.resolve(true);

    if (this.autoCreate.length) {
      console.log('Auto-creating', this.autoCreate.map(x => x.target.name));
      let items = this.autoCreate.slice(0).sort((a, b) => a.priority - b.priority);
      for (let i of items) {
        await this.getInstance(i.target, i.name);
      }
    }
  }

  onNewClassConfig(cls: Class) {
    this.pendingFinalize.push(cls);

    return {
      name: DEFAULT_INSTANCE,
      class: cls,
      target: cls,
      dependencies: {
        fields: {},
        cons: []
      },
      autoCreate: {
        create: false,
        priority: 1000
      }
    };
  }

  async construct<T>(target: ClassTarget<T & ManagedExtra>, name: string = DEFAULT_INSTANCE): Promise<T> {
    let targetId = target.__id!;

    let aliasMap = this.aliases.get(targetId);

    if (!aliasMap || !aliasMap.has(name)) {
      throw new InjectionError(`Dependency not found: ${targetId}[${name}]`);
    }

    let clz = aliasMap.get(name)!;
    let managed = this.finalClasses.get(clz)!;

    const fieldKeys = Object.keys(managed.dependencies.fields!);

    let consDeps = managed.dependencies.cons || [];

    const promises =
      consDeps
        .concat(fieldKeys.map(x => managed.dependencies.fields[x]))
        .map(async x => {
          try {
            return await this.getInstance(x.target, x.name);
          } catch (e) {
            if (x.optional && e instanceof InjectionError) {
              return undefined;
            } else {
              throw e;
            }
          }
        });

    const allDeps = await Promise.all(promises);

    const consValues = allDeps.slice(0, consDeps.length);
    const fieldValues = allDeps.slice(consDeps.length);

    const inst = new managed.class(...consValues);

    for (let i = 0; i < fieldKeys.length; i++) {
      (inst as any)[fieldKeys[i]] = fieldValues[i];
    }

    if (inst.postConstruct) {
      await inst.postConstruct();
    }
    return inst;
  }

  private async createInstance<T>(target: ClassTarget<T>, name: string = DEFAULT_INSTANCE) {
    let instance = await this.construct(target, name);
    let targetId = target.__id!;

    if (!this.instances.has(targetId)) {
      this.instances.set(targetId, new Map());
      this.proxyHandlers.set(targetId, new Map());
    }

    let out: any = instance;

    if (AppEnv.watch) {
      if (!this.instances.has(targetId) || !this.instances.get(targetId)!.has(name)) {
        console.log('Registering proxy', target.name, name);
        let handler = new RetargettingHandler(out);
        out = new Proxy({}, handler);
        this.proxyHandlers.get(targetId)!.set(name, handler);
      } else {
        console.log('Updating target');
        this.proxyHandlers.get(targetId)!.get(name)!.target = out;
        // Don't re-set instance
        return;
      }
    }

    this.instances.get(targetId)!.set(name, out);
  }

  async getInstance<T>(target: ClassTarget<T>, name: string = DEFAULT_INSTANCE): Promise<T> {
    let targetId = target.__id!;
    if (!this.instances.has(targetId) || !this.instances.get(targetId)!.has(name)) {
      await this.createInstance(target, name);
    }
    return this.instances.get(targetId)!.get(name)!;
  }

  getCandidateTypes<T>(target: Class<T>) {
    let targetId = target.__id!;
    let aliasMap = this.aliases.get(targetId)!;
    let aliasedIds = aliasMap ? Array.from(aliasMap.values()) : [];
    return aliasedIds.map(id => this.finalClasses.get(id)!)
  }

  // Undefined indicates no constructor
  registerConstructor<T>(cls: Class<T>, dependencies?: Dependency<any>[]) {
    let conf = this.getOrCreateClassConfig(cls);
    conf.dependencies!.cons = dependencies;
    if (dependencies) {
      for (let dependency of dependencies) {
        dependency.name = dependency.name || DEFAULT_INSTANCE;
      }
    }
  }

  registerProperty<T>(cls: Class<T>, field: string, dependency: Dependency<any>) {
    let conf = this.getOrCreateClassConfig(cls);
    conf.dependencies!.fields[field] = dependency;
    dependency.name = dependency.name || DEFAULT_INSTANCE;
  }

  registerClass<T>(cls: Class<T>, pconfig: Partial<InjectableConfig<T>>) {
    let classId = pconfig.class!.__id!;
    let config = this.getOrCreateClassConfig(pconfig.class!);

    if (pconfig.name) {
      config.name = pconfig.name;
    }
    if (pconfig.target) {
      config.target = pconfig.target;
    }
    if (pconfig.autoCreate) {
      config.autoCreate!.create = pconfig.autoCreate.create;
      if (pconfig.autoCreate.priority !== undefined) {
        config.autoCreate!.priority = pconfig.autoCreate.priority;
      }
    }
  }

  onFinalize<T>(cls: Class<T>) {
    let classId = cls!.__id!;
    let config = this.getOrCreateClassConfig(cls) as InjectableConfig<T>;


    let parentClass = Object.getPrototypeOf(cls);
    let parentConfig = this.finalClasses.get(parentClass.__id);

    if (parentConfig) {
      config.dependencies.fields = Object.assign({},
        parentConfig.dependencies!.fields,
        config.dependencies.fields);

      // Inherit cons deps if no constructor defined
      if (config.dependencies.cons === undefined) {
        config.dependencies.cons = parentConfig.dependencies.cons;
      }
    }

    let targetId = config.target.__id!;

    if (!this.aliases.has(targetId)) {
      this.aliases.set(targetId, new Map());
    }

    this.aliases.get(targetId)!.set(config.name, classId);

    // TODO: Auto alias parent class if framework managed
    if (parentClass.__id && config.name !== DEFAULT_INSTANCE) {
      let parentId = parentClass.__id;
      this.aliases.get(parentId)!.set(config.name, classId);
    }

    if (AppEnv.watch &&
      this.proxyHandlers.has(targetId) &&
      this.proxyHandlers.get(targetId)!.has(config.name)
    ) {
      let p = this.createInstance(config.target, config.name);
    } else if (config.autoCreate.create) {
      this.autoCreate.push({
        target: config.target,
        name: config.name,
        priority: config.autoCreate.priority!
      })
    }

    return config;
  }
}

export const DependencyRegistry = new $DependencyRegistry();