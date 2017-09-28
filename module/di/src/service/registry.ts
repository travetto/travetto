import { Dependency, InjectableConfig, ClassTarget } from '../types';
import { InjectionError } from './error';
import { MetadataRegistry, Class, RootRegistry, ChangeEvent } from '@encore2/registry';
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
  private aliases = new Map<TargetId, Map<string, string>>();
  private targets = new Map<ClassId, Map<string, TargetId>>();

  private proxies = new Map<TargetId, Map<string, Proxy<RetargettingHandler<any>>>>();
  private proxyHandlers = new Map<TargetId, Map<string, RetargettingHandler<any>>>();

  private autoCreate: (Dependency<any> & { priority: number })[] = [];

  constructor() {
    super(RootRegistry);
  }

  async initialInstall() {
    let finalizing = this.pendingFinalize;
    this.pendingFinalize = [];

    for (let cls of finalizing) {
      this.install(cls, { type: 'added', curr: cls });
    }

    // Unblock auto created
    if (this.autoCreate.length) {
      console.debug('Auto-creating', this.autoCreate.map(x => x.target.name));
      let items = this.autoCreate.slice(0).sort((a, b) => a.priority - b.priority);
      for (let i of items) {
        await this.getInstance(i.target, i.name);
      }
    }
  }

  createPending(cls: Class) {
    if (!this.resolved) {
      this.pendingFinalize.push(cls);
    }

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
    let targetId = target.__id;

    let aliasMap = this.aliases.get(targetId);

    if (!aliasMap || !aliasMap.has(name)) {
      throw new InjectionError(`Dependency not found: ${targetId}[${name}]`);
    }

    let clz = aliasMap.get(name)!;
    let managed = this.get(clz)!;

    const fieldKeys = Object.keys(managed.dependencies.fields!);

    let consDeps = managed.dependencies.cons || [];
    let allDeps = consDeps.concat(fieldKeys.map(x => managed.dependencies.fields[x]))

    const promises = allDeps
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

    const all = await Promise.all(promises);

    const consValues = all.slice(0, consDeps.length);
    const fieldValues = all.slice(consDeps.length);

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
    let targetId = target.__id;

    if (!this.instances.has(targetId)) {
      this.instances.set(targetId, new Map());
    }

    if (AppEnv.watch) {
      if (!this.proxies.has(targetId)) {
        this.proxies.set(targetId, new Map());
        this.proxyHandlers.set(targetId, new Map());
      }
    }

    let out: any = instance;

    console.debug('Creating Instance', targetId, AppEnv.watch, !this.proxyHandlers.has(targetId), this.proxyHandlers.has(targetId) && !this.proxyHandlers.get(targetId)!.has(name))

    // if in watch mode, create proxies
    if (AppEnv.watch) {
      if (!this.proxies.get(targetId)!.has(name)) {
        let handler = new RetargettingHandler(out);
        let proxy = new Proxy({}, handler);
        this.proxyHandlers.get(targetId)!.set(name, handler);
        this.proxies.get(targetId)!.set(name, proxy);
        out = proxy;
        console.debug('Registering proxy', target.__id, name);
      } else {
        let handler = this.proxyHandlers.get(targetId)!.get(name)!;
        console.debug('Updating target', target.__id, name, out);
        handler.target = out;
        out = this.proxies.get(targetId)!.get(name);
      }
    }

    this.instances.get(targetId)!.set(name, out);
  }

  async getInstance<T>(target: ClassTarget<T>, name: string = DEFAULT_INSTANCE): Promise<T> {
    let targetId = target.__id;
    if (!this.instances.has(targetId) || !this.instances.get(targetId)!.has(name)) {
      console.debug('Getting Intance', targetId, name);
      await this.createInstance(target, name);
    }
    return this.instances.get(targetId)!.get(name)!;
  }

  getCandidateTypes<T>(target: Class<T>) {
    let targetId = target.__id;
    let aliasMap = this.aliases.get(targetId)!;
    let aliasedIds = aliasMap ? Array.from(aliasMap.values()) : [];
    return aliasedIds.map(id => this.get(id)!)
  }

  // Undefined indicates no constructor
  registerConstructor<T>(cls: Class<T>, dependencies?: Dependency<any>[]) {
    let conf = this.getOrCreatePending(cls);
    conf.dependencies!.cons = dependencies;
    if (dependencies) {
      for (let dependency of dependencies) {
        dependency.name = dependency.name || DEFAULT_INSTANCE;
      }
    }
  }

  registerProperty<T>(cls: Class<T>, field: string, dependency: Dependency<any>) {
    let conf = this.getOrCreatePending(cls);
    conf.dependencies!.fields[field] = dependency;
    dependency.name = dependency.name || DEFAULT_INSTANCE;
  }

  registerClass<T>(cls: Class<T>, pconfig: Partial<InjectableConfig<T>>) {
    let classId = pconfig.class!.__id;
    let config = this.getOrCreatePending(pconfig.class!);

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

  onInstallFinalize<T>(cls: Class<T>) {
    let classId = cls.__id;

    console.debug('Finalized', classId);

    let config = this.getOrCreatePending(cls) as InjectableConfig<T>;

    let parentClass = Object.getPrototypeOf(cls);
    let parentConfig = this.get(parentClass.__id);

    if (parentConfig) {
      config.dependencies.fields = Object.assign({},
        parentConfig.dependencies!.fields,
        config.dependencies.fields);

      // Inherit cons deps if no constructor defined
      if (config.dependencies.cons === undefined) {
        config.dependencies.cons = parentConfig.dependencies.cons;
      }
    }

    if (!this.targets.has(classId)) {
      this.targets.set(classId, new Map());
    }

    let targetId = config.target.__id;

    if (!this.aliases.has(targetId)) {
      this.aliases.set(targetId, new Map());
    }

    this.aliases.get(targetId)!.set(config.name, classId);
    this.targets.get(classId)!.set(config.name, targetId);

    // TODO: Auto alias parent class if framework managed
    if (parentClass.__id && config.name !== DEFAULT_INSTANCE) {
      let parentId = parentClass.__id;
      this.aliases.get(parentId)!.set(config.name, classId);
      this.targets.get(classId)!.set(config.name, parentId);
    }

    // If already loaded, reload
    if (AppEnv.watch &&
      this.proxies.has(targetId) &&
      this.proxies.get(targetId)!.has(config.name)
    ) {
      console.debug('Reloading on next tick');
      // Timing matters b/c of create instance
      process.nextTick(() => this.createInstance(config.target, config.name));
    } else if (config.autoCreate.create) {
      // If not loaded, and autocreate
      this.autoCreate.push({
        target: config.target,
        name: config.name,
        priority: config.autoCreate.priority!
      })
    }

    return config;
  }

  onUninstallFinalize(cls: Class) {
    if (!this.targets.has(cls.__id)) {
      return;
    }

    // Remove current instance
    for (let [config, targetId] of this.targets.get(cls.__id)!.entries()) {
      if (this.instances.has(targetId) &&
        this.instances.get(targetId)!.has(config) &&
        this.instances.get(targetId)!.get(config).constructor.__id === cls.__id
      ) {
        let handler = this.proxyHandlers.get(targetId)!.get(config)
        if (handler) {
          handler.target = null;
        }

        this.instances.get(targetId)!.delete(config);
        console.debug('On uninstall', cls.__id, config, targetId, handler);
        this.targets.get(cls.__id)!.delete(config);
      }
    }
  }

  onReset() {
    super.onReset();
    this.pendingFinalize = [];
    this.instances.clear();
    this.proxies.clear();
    this.proxyHandlers.clear();
    this.aliases.clear();
    this.targets.clear();
    this.autoCreate = [];
  }
}

export const DependencyRegistry = new $DependencyRegistry();