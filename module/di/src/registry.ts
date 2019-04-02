import { MetadataRegistry, Class, RootRegistry, ChangeEvent } from '@travetto/registry';
import { Util } from '@travetto/base';
import { Env } from '@travetto/base/bootstrap';
import { RetargettingHandler } from '@travetto/compiler';

import { Dependency, InjectableConfig, ClassTarget, InjectableFactoryConfig, ApplicationConfig } from './types';
import { InjectionError } from './error';

export const DEFAULT_INSTANCE = Symbol('__default');

export interface ManagedExtra {
  postConstruct?: () => any;
}

type TargetId = string;
type ClassId = string;

type Proxy<T = any> = any;

function getName(symbol: symbol) {
  return symbol.toString().split(/[()]/g)[1];
}

function mergeWithOptional<T extends { original?: symbol | object, qualifier?: symbol }>(o: T) {
  if (o.original) {
    if (typeof o.original === 'symbol') {
      o.qualifier = o.original;
    } else if (Util.isPlainObject(o.original)) {
      Util.deepAssign(o, o.original);
    }
    o.original = undefined;
  }
  return o;
}

export class $DependencyRegistry extends MetadataRegistry<InjectableConfig> {
  private pendingFinalize: Class[] = [];

  private instances = new Map<TargetId, Map<Symbol, any>>();
  private instancePromises = new Map<TargetId, Map<Symbol, Promise<any>>>();

  private factories = new Map<TargetId, Map<Class, InjectableConfig>>();

  private aliases = new Map<TargetId, Map<Symbol, string>>();
  private targets = new Map<ClassId, Map<Symbol, TargetId>>();

  private proxies = new Map<TargetId, Map<Symbol, Proxy<RetargettingHandler<any>>>>();
  private proxyHandlers = new Map<TargetId, Map<Symbol, RetargettingHandler<any>>>();

  private applications = new Map<string, ApplicationConfig>();

  constructor() {
    super(RootRegistry);
  }

  private async createInstance<T>(target: ClassTarget<T>, qualifier: symbol = DEFAULT_INSTANCE) {
    const targetId = target.__id;

    if (!this.instances.has(targetId)) {
      this.instances.set(targetId, new Map());
      this.instancePromises.set(targetId, new Map());
    }

    if (this.instancePromises.get(targetId)!.has(qualifier)) {
      return this.instancePromises.get(targetId)!.get(qualifier);
    }

    const instancePromise = this.construct(target, qualifier);
    this.instancePromises.get(targetId)!.set(qualifier, instancePromise);

    const instance = await instancePromise;

    if (Env.watch) {
      if (!this.proxies.has(targetId)) {
        this.proxies.set(targetId, new Map());
        this.proxyHandlers.set(targetId, new Map());
      }
    }

    let out: any = instance;

    console.trace('Creating Instance', targetId, Env.watch,
      !this.proxyHandlers.has(targetId),
      this.proxyHandlers.has(targetId) && !this.proxyHandlers.get(targetId)!.has(qualifier));

    // if in watch mode, create proxies
    if (Env.watch) {
      if (!this.proxies.get(targetId)!.has(qualifier)) {
        const handler = new RetargettingHandler(out);
        const proxy = new Proxy({}, handler);
        this.proxyHandlers.get(targetId)!.set(qualifier, handler);
        this.proxies.get(targetId)!.set(qualifier, proxy);
        out = proxy;
        console.trace('Registering proxy', target.__id, qualifier);
      } else {
        const handler = this.proxyHandlers.get(targetId)!.get(qualifier)!;
        console.trace('Updating target', target.__id, qualifier, out);
        handler.target = out;
        out = this.proxies.get(targetId)!.get(qualifier);
      }
    }

    this.instances.get(targetId)!.set(qualifier, out);
  }

  async initialInstall() {
    const finalizing = this.pendingFinalize;
    this.pendingFinalize = [];

    for (const cls of finalizing) {
      this.install(cls, { type: 'added', curr: cls });
    }
  }

  createPending(cls: Class) {
    if (!this.resolved) {
      this.pendingFinalize.push(cls);
    }

    return {
      qualifier: DEFAULT_INSTANCE,
      class: cls,
      target: cls,
      dependencies: {
        fields: {},
        cons: []
      }
    };
  }

  async fetchDependencies(managed: InjectableConfig<any>, deps?: Dependency<any>[]) {
    if (!deps || !deps.length) {
      return [];
    }

    for (const dep of deps) {
      mergeWithOptional(dep);
    }

    const promises = deps
      .map(async x => {
        try {
          return await this.getInstance(x.target, x.qualifier);
        } catch (e) {

          if (x.defaultIfMissing && e instanceof InjectionError && e.category === 'notfound') {
            try {
              return await this.getInstance(x.defaultIfMissing);
            } catch (e2) {
              e = e2;
            }
          }

          if (x.optional && e instanceof InjectionError && e.category === 'notfound') {

            return undefined;
          } else {
            e.message = `${e.message} for ${managed.class.__id}`;
            throw e;
          }
        }
      });

    return await Promise.all(promises);
  }

  async resolveFieldDependencies<T>(keys: string[], config: InjectableConfig<T>, instance: T) {
    // And auto-wire
    if (keys.length) {
      const deps = await this.fetchDependencies(config, keys.map(x => config.dependencies.fields[x]));
      for (let i = 0; i < keys.length; i++) {
        (instance as any)[keys[i]] = deps[i];
      }
    }
  }

  async construct<T>(target: ClassTarget<T & ManagedExtra>, qualifier: symbol = DEFAULT_INSTANCE): Promise<T> {
    const targetId = target.__id;

    const aliasMap = this.aliases.get(targetId);

    if (!aliasMap || !aliasMap.has(qualifier)) {
      throw new InjectionError(`Dependency not found: ${targetId}[${getName(qualifier)}]`, 'notfound');
    }

    const clz = aliasMap.get(qualifier)!;
    const managed = this.get(clz)!;

    // Only fetch constructor values
    const consValues = await this.fetchDependencies(managed, managed.dependencies.cons);

    // Create instance
    const inst = managed.factory ?
      managed.factory(...consValues) :
      new managed.class(...consValues);

    // Compute fields to be auto-wired
    const fieldKeys = Object.keys(managed.dependencies.fields!)
      .filter(x => !managed.factory || !(x in inst)); // Only apply fields that were not set on the factory instance

    // And auto-wire fields
    await this.resolveFieldDependencies(fieldKeys, managed, inst);

    // If factory with field properties on the sub class
    if (managed.factory) {
      const resolved = this.get(inst.constructor);

      if (resolved) {
        const subKeys = Object.keys(resolved.dependencies.fields).filter(x => !managed.dependencies.fields[x]);
        await this.resolveFieldDependencies(subKeys, resolved, inst);
      }
    }

    // Run post construct
    if (inst.postConstruct) {
      await inst.postConstruct();
    }

    return inst;
  }

  async getInstance<T>(target: ClassTarget<T>, qualifier: symbol = DEFAULT_INSTANCE): Promise<T> {
    this.verifyInitialized();

    const targetId = target.__id;
    if (!this.instances.has(targetId) || !this.instances.get(targetId)!.has(qualifier)) {
      console.trace('Getting Instance', targetId, getName(qualifier));
      await this.createInstance(target, qualifier);
    }
    return this.instances.get(targetId)!.get(qualifier)!;
  }

  getCandidateTypes<T>(target: Class<T>) {
    const targetId = target.__id;
    const aliasMap = this.aliases.get(targetId)!;
    const aliasedIds = aliasMap ? Array.from(new Set(aliasMap.values())) : [];
    return aliasedIds.map(id => this.get(id)! as InjectableConfig<T>);
  }

  registerApplication(app: string, config: ApplicationConfig) {
    this.applications.set(app, config);
  }

  getApplications() {
    return Array.from(this.applications.values());
  }

  async runApplication(name: string, args: any[]) {
    const config = this.applications.get(name);
    if (!config) {
      throw new InjectionError(`Application: ${name} does not exist`, 'notfound');
    }
    const inst = await this.getInstance(config.target);
    if (inst.run) {
      await inst.run(...args);
    }
  }

  // Undefined indicates no constructor
  registerConstructor<T>(cls: Class<T>, dependencies?: Dependency<any>[]) {
    const conf = this.getOrCreatePending(cls);
    conf.dependencies!.cons = dependencies;
    if (dependencies) {
      for (const dependency of dependencies) {
        dependency.qualifier = dependency.qualifier || DEFAULT_INSTANCE;
      }
    }
  }

  registerProperty<T>(cls: Class<T>, field: string, dependency: Dependency<any>) {
    const conf = this.getOrCreatePending(cls);

    conf.dependencies!.fields[field] = dependency;
    dependency.qualifier = dependency.qualifier || DEFAULT_INSTANCE;
  }

  /**  Last one to register wins */
  registerClass<T>(cls: Class<T>, pconfig: Partial<InjectableConfig<T>>) {
    const config = this.getOrCreatePending(pconfig.class!);

    config.class = cls;

    if (pconfig.factory) {
      config.factory = pconfig.factory;
    }
    if (pconfig.qualifier) {
      config.qualifier = pconfig.qualifier;
    }
    if (pconfig.target) {
      config.target = pconfig.target;
    }
    if (pconfig.dependencies) {
      config.dependencies = { fields: {}, ...pconfig.dependencies };
    }
  }

  registerFactory(config: InjectableFactoryConfig<any> & { fn: (...args: any[]) => any, id?: string }) {
    const finalConfig: InjectableConfig<any> = {} as any;

    mergeWithOptional(config);

    finalConfig.factory = config.fn;
    finalConfig.target = config.class;

    if (config.qualifier) {
      finalConfig.qualifier = config.qualifier;
    }

    finalConfig.dependencies = { fields: {} };

    if (config.dependencies) {
      finalConfig.dependencies.cons = config.dependencies;
    }

    // Create mock cls for DI purposes
    const cls = { __id: config.id || `${config.class.__id}#${config.fn.name}` } as Class<any>;

    finalConfig.class = cls;

    this.registerClass(cls, finalConfig);

    if (!this.factories.has(config.src.__id)) {
      this.factories.set(config.src.__id, new Map());
    }

    this.factories.get(config.src.__id)!.set(cls, finalConfig);
  }

  onInstall<T>(cls: Class<T>, e: ChangeEvent<Class<T>>) {
    super.onInstall(cls, e);

    // Install factories separate from classes
    if (this.factories.has(cls.__id)) {
      for (const fact of this.factories.get(cls.__id)!.keys()) {
        this.onInstall(fact, e);
      }
    }
  }

  onInstallFinalize<T>(cls: Class<T>) {
    const classId = cls.__id;

    const config = this.getOrCreatePending(cls) as InjectableConfig<T>;

    // Allow for the factory to fulfill the target
    const parentClass = config.factory ? config.target : Object.getPrototypeOf(cls);
    const parentConfig = this.get(parentClass.__id);

    if (parentConfig) {
      config.dependencies.fields = {
        ...parentConfig.dependencies!.fields,
        ...config.dependencies.fields
      };

      // Inherit cons deps if no constructor defined
      if (config.dependencies.cons === undefined) {
        config.dependencies.cons = parentConfig.dependencies.cons;
      }
    }

    if (cls.__abstract) { // Skip out early, only needed to inherit
      return config;
    }

    if (!this.targets.has(classId)) {
      this.targets.set(classId, new Map());
    }

    const targetId = config.target.__id;

    if (!this.aliases.has(targetId)) {
      this.aliases.set(targetId, new Map());
    }

    this.aliases.get(targetId)!.set(config.qualifier, classId);
    this.targets.get(classId)!.set(config.qualifier, targetId);

    // If targeting self (default @Injectable behavior)
    if (classId === targetId && (parentConfig || parentClass.__abstract)) {
      const parentId = parentClass.__id;
      const qualifier = config.qualifier === DEFAULT_INSTANCE ? Symbol(`Extends-${parentId}-${classId}`) : config.qualifier;

      if (!this.aliases.has(parentId)) {
        this.aliases.set(parentId, new Map());
      }

      // First type will be default
      if (!this.aliases.get(parentId)!.has(DEFAULT_INSTANCE)) {
        this.aliases.get(parentId)!.set(DEFAULT_INSTANCE, classId);
      }

      this.aliases.get(parentId)!.set(qualifier, classId);
      this.targets.get(classId)!.set(qualifier, parentId);
    }

    // If already loaded, reload
    if (Env.watch &&
      this.proxies.has(targetId) &&
      this.proxies.get(targetId)!.has(config.qualifier)
    ) {
      console.debug('Reloading on next tick');
      // Timing matters due to create instance being asynchronous
      process.nextTick(() => this.createInstance(config.target, config.qualifier));
    }

    return config;
  }

  onUninstallFinalize(cls: Class) {
    if (!this.targets.has(cls.__id)) {
      return;
    }

    // Remove current instance
    for (const [config, targetId] of this.targets.get(cls.__id)!.entries()) {
      if (this.instances.has(targetId) &&
        this.instances.get(targetId)!.has(config) &&
        this.instances.get(targetId)!.get(config).constructor.__id === cls.__id
      ) {
        const activeInstance = this.instances.get(targetId)!.get(config);
        if (activeInstance && activeInstance.preDestroy) {
          activeInstance.preDestroy();
        }

        const handler = this.proxyHandlers.get(targetId)!.get(config);
        if (handler) {
          handler.target = null;
        }
        this.instances.get(targetId)!.delete(config);
        this.instancePromises.get(targetId)!.delete(config);
        console.trace('On uninstall', cls.__id, config, targetId, handler);
        this.targets.get(cls.__id)!.delete(config);
      }
    }
  }

  onReset() {
    super.onReset();
    this.resolved = false;
    this.pendingFinalize = [];
    this.instances.clear();
    this.instancePromises.clear();
    this.proxies.clear();
    this.proxyHandlers.clear();
    this.aliases.clear();
    this.targets.clear();
    this.factories.clear();
    this.applications.clear();
  }
}

export const DependencyRegistry = new $DependencyRegistry();