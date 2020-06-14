import { MetadataRegistry, Class, RootRegistry, ChangeEvent } from '@travetto/registry';
import { Util } from '@travetto/base';
import { Watchable } from '@travetto/base/src/internal/watchable';

import { Dependency, InjectableConfig, ClassTarget, InjectableFactoryConfig } from './types';
import { InjectionError } from './error';

export const DEFAULT_INSTANCE = Symbol.for('@trv:di/default');

export interface ManagedExtra {
  postConstruct?: () => any;
}

type TargetId = string;
type ClassId = string;

function getName(symbol: symbol) {
  return symbol.toString().split(/[()]/g)[1];
}

/** Merge config at runtime as needed */
function mergeWithOriginal<T extends { original?: symbol | object, qualifier?: symbol }>(o: T) {
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

/**
 * Dependency registry
 */
@Watchable('@travetto/di/support/watch.injection')
export class $DependencyRegistry extends MetadataRegistry<InjectableConfig> {
  protected pendingFinalize: Class[] = [];

  protected instances = new Map<TargetId, Map<symbol, any>>();
  protected instancePromises = new Map<TargetId, Map<symbol, Promise<any>>>();

  protected factories = new Map<TargetId, Map<Class, InjectableConfig>>();

  protected targetToClass = new Map<TargetId, Map<symbol, string>>();
  protected classToTarget = new Map<ClassId, Map<symbol, TargetId>>();

  constructor() {
    super(RootRegistry);
  }

  /**
   * Convert target to actual injectable config
   */
  protected resolveTargetToClass<T>(target: ClassTarget<T>, qualifier: symbol): InjectableConfig<any> {
    const targetId = target.ᚕid;

    const qualifiers = this.targetToClass.get(targetId);

    if (!qualifiers || !qualifiers.has(qualifier)) {
      throw new InjectionError(`Dependency not found: ${targetId}[${getName(qualifier)}]`, 'notfound');
    }

    const clz = qualifiers.get(qualifier)!;
    return this.get(clz);
  }

  protected resolveClassId<T>(target: ClassTarget<T>, qualifier: symbol): string {
    const managed = this.resolveTargetToClass(target, qualifier);
    return (managed.factory ? managed.target : managed.class).ᚕid;
  }

  /**
   * Retrieve all dependencies
   */
  protected async fetchDependencies(managed: InjectableConfig<any>, deps?: Dependency<any>[]) {
    if (!deps || !deps.length) {
      return [];
    }

    for (const dep of deps) {
      mergeWithOriginal(dep);
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
            e.message = `${e.message} for ${managed.class.ᚕid}`;
            throw e;
          }
        }
      });

    return await Promise.all(promises);
  }

  /**
   * Resolve all field dependencies
   */
  protected async resolveFieldDependencies<T>(keys: string[], config: InjectableConfig<T>, instance: T) {
    // And auto-wire
    if (keys.length) {
      const deps = await this.fetchDependencies(config, keys.map(x => config.dependencies.fields[x]));
      for (let i = 0; i < keys.length; i++) {
        instance[keys[i] as keyof T] = deps[i];
      }
    }
  }

  /**
   * Actually construct an instance while resolving the dependencies
   */
  protected async construct<T>(target: ClassTarget<T & ManagedExtra>, qualifier: symbol = DEFAULT_INSTANCE): Promise<T> {
    const managed = this.resolveTargetToClass(target, qualifier);

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

  /**
   * Create the instance
   */
  protected async createInstance<T>(target: ClassTarget<T>, qualifier: symbol = DEFAULT_INSTANCE) {
    const classId = this.resolveClassId(target, qualifier);

    if (!this.instances.has(classId)) {
      this.instances.set(classId, new Map());
      this.instancePromises.set(classId, new Map());
    }

    if (this.instancePromises.get(classId)!.has(qualifier)) {
      return this.instancePromises.get(classId)!.get(qualifier);
    }

    const instancePromise = this.construct(target, qualifier);
    this.instancePromises.get(classId)!.set(qualifier, instancePromise);

    const instance = await instancePromise;
    this.instances.get(classId)!.set(qualifier, instance);

    console.debug('Creating Instance', classId);

    return instance;
  }

  /**
   * Destroy an instance
   */
  protected destroyInstance(cls: Class, qualifier: symbol) {
    const classId = cls.ᚕid;

    const activeInstance = this.instances.get(classId)!.get(qualifier);
    if (activeInstance && activeInstance.preDestroy) {
      activeInstance.preDestroy();
    }

    this.instances.get(classId)!.delete(qualifier);
    this.instancePromises.get(classId)!.delete(qualifier);
    this.classToTarget.get(cls.ᚕid)!.delete(qualifier);
    console.debug('On uninstall', cls.ᚕid, qualifier, classId);
  }

  /**
   * Handle initial installation for the entire registry
   */
  async initialInstall() {
    const finalizing = this.pendingFinalize;
    this.pendingFinalize = [];

    for (const cls of finalizing) {
      this.install(cls, { type: 'added', curr: cls });
    }
  }

  /**
   * Register a cls as pending
   */
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


  /**
   * Get an instance by type and qualifier
   */
  async getInstance<T>(target: ClassTarget<T>, qualifier: symbol = DEFAULT_INSTANCE): Promise<T> {
    this.verifyInitialized();

    const classId = this.resolveClassId(target, qualifier);

    if (!this.instances.has(classId) || !this.instances.get(classId)!.has(qualifier)) {
      await this.createInstance(target, qualifier); // Wait for proxy
    }
    return this.instances.get(classId)!.get(qualifier)!;
  }

  /**
   * Get all available candidate types for the target
   */
  getCandidateTypes<T>(target: Class<T>) {
    const targetId = target.ᚕid;
    const qualifiers = this.targetToClass.get(targetId)!;
    const uniqueQualifiers = qualifiers ? Array.from(new Set(qualifiers.values())) : [];
    return uniqueQualifiers.map(id => this.get(id)! as InjectableConfig<T>);
  }

  /**
   * Register a constructor with dependencies
   */
  registerConstructor<T>(cls: Class<T>, dependencies?: Dependency<any>[]) {
    const conf = this.getOrCreatePending(cls);
    conf.dependencies!.cons = dependencies;
    if (dependencies) {
      for (const dependency of dependencies) {
        dependency.qualifier = dependency.qualifier ?? DEFAULT_INSTANCE;
      }
    }
  }

  /**
   * Register a property as a dependency
   */
  registerProperty<T>(cls: Class<T>, field: string, dependency: Dependency<any>) {
    const conf = this.getOrCreatePending(cls);

    conf.dependencies!.fields[field] = dependency;
    dependency.qualifier = dependency.qualifier ?? DEFAULT_INSTANCE;
  }

  /**
   * Register a class
   *
   * Last one to register wins
   */
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
      config.dependencies = {
        // @ts-ignore
        fields: {},
        ...pconfig.dependencies
      };
    }
  }

  /**
   * Register a factory configuration
   */
  registerFactory(config: InjectableFactoryConfig<any> & { fn: (...args: any[]) => any, id: string }) {
    const finalConfig: Partial<InjectableConfig<any>> = {};

    mergeWithOriginal(config);

    finalConfig.factory = config.fn;
    finalConfig.target = config.target;

    if (config.qualifier) {
      finalConfig.qualifier = config.qualifier;
    }

    finalConfig.dependencies = { fields: {} };

    if (config.dependencies) {
      finalConfig.dependencies.cons = config.dependencies;
    }

    // Create mock cls for DI purposes
    const cls = { ᚕid: config.id } as Class<any>;

    finalConfig.class = cls;

    this.registerClass(cls, finalConfig);

    if (!this.factories.has(config.src.ᚕid)) {
      this.factories.set(config.src.ᚕid, new Map());
    }

    this.factories.get(config.src.ᚕid)!.set(cls, finalConfig as InjectableConfig);
  }

  /**
   * On Install event
   */
  onInstall<T>(cls: Class<T>, e: ChangeEvent<Class<T>>) {
    super.onInstall(cls, e);

    // Install factories separate from classes
    if (this.factories.has(cls.ᚕid)) {
      for (const fact of this.factories.get(cls.ᚕid)!.keys()) {
        this.onInstall(fact, e);
      }
    }
  }

  /**
   * Handle installing a class
   */
  onInstallFinalize<T>(cls: Class<T>) {
    const classId = cls.ᚕid;

    const config = this.getOrCreatePending(cls) as InjectableConfig<T>;

    // Allow for the factory to fulfill the target
    let parentClass = config.factory ? config.target : Object.getPrototypeOf(cls);

    if (config.factory) {
      while (Object.getPrototypeOf(parentClass).ᚕabstract) {
        parentClass = Object.getPrototypeOf(parentClass);
      }
    }

    const parentConfig = this.get(parentClass.ᚕid);

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

    if (cls.ᚕabstract) { // Skip out early, only needed to inherit
      return config;
    }

    if (!this.classToTarget.has(classId)) {
      this.classToTarget.set(classId, new Map());
    }

    const targetId = config.target.ᚕid;

    if (!this.targetToClass.has(targetId)) {
      this.targetToClass.set(targetId, new Map());
    }

    this.targetToClass.get(targetId)!.set(config.qualifier, classId);
    this.classToTarget.get(classId)!.set(config.qualifier, targetId);

    // If targeting self (default @Injectable behavior)
    if ((classId === targetId || config.factory) && (parentConfig || parentClass.ᚕabstract)) {
      const parentId = parentClass.ᚕid;
      const qualifier = config.qualifier === DEFAULT_INSTANCE ? Symbol.for(`@trv:di/Extends-${parentId}-${classId}`) : config.qualifier;

      if (!this.targetToClass.has(parentId)) {
        this.targetToClass.set(parentId, new Map());
      }

      // First type will be default
      if (!this.targetToClass.get(parentId)!.has(DEFAULT_INSTANCE)) {
        this.targetToClass.get(parentId)!.set(DEFAULT_INSTANCE, classId);
      }

      this.targetToClass.get(parentId)!.set(qualifier, classId);
      this.classToTarget.get(classId)!.set(qualifier, parentId);
    }

    return config;
  }

  /**
   * Handle uninstalling a class
   */
  onUninstallFinalize(cls: Class) {
    const classId = cls.ᚕid;

    if (!this.classToTarget.has(cls.ᚕid)) {
      return;
    }

    if (this.instances.has(classId)) {
      for (const qualifier of this.classToTarget.get(classId)!.keys()) {
        this.destroyInstance(cls, qualifier);
      }
    }
  }

  /**
   * Reset registry
   */
  onReset() {
    super.onReset();
    this.resolved = false;
    this.pendingFinalize = [];
    this.instances.clear();
    this.instancePromises.clear();
    this.targetToClass.clear();
    this.classToTarget.clear();
    this.factories.clear();
  }
}

export const DependencyRegistry = new $DependencyRegistry();