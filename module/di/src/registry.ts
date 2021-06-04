import { Class, ClassInstance, ConcreteClass } from '@travetto/base';
import { MetadataRegistry, RootRegistry, ChangeEvent } from '@travetto/registry';
import { Dynamic } from '@travetto/base/src/internal/dynamic';

import { Dependency, InjectableConfig, ClassTarget, InjectableFactoryConfig } from './types';
import { InjectionError } from './error';

type TargetId = string;
type ClassId = string;
type Resolved<T> = { config: InjectableConfig<T>, qualifier: symbol, id: string };

export type ResolutionType = 'strict' | 'loose' | 'any';

const PrimaryCandidateⲐ = Symbol.for('@trv:di/primary');

function hasPostConstruct(o: unknown): o is { postConstruct: () => Promise<unknown> } {
  return !!o && !!(o as Record<string, unknown>)['postConstruct'];
}

function hasPreDestroy(o: unknown): o is { preDestroy: () => unknown } {
  return !!o && !!(o as Record<string, unknown>)['preDestroy'];
}

/**
 * Dependency registry
 */
@Dynamic('@travetto/di/support/dynamic.injection')
class $DependencyRegistry extends MetadataRegistry<InjectableConfig> {
  protected pendingFinalize: Class[] = [];

  protected defaultSymbols = new Set<symbol>();

  protected instances = new Map<TargetId, Map<symbol, unknown>>();
  protected instancePromises = new Map<TargetId, Map<symbol, Promise<unknown>>>();

  protected factories = new Map<TargetId, Map<Class, InjectableConfig>>();

  protected targetToClass = new Map<TargetId, Map<symbol, string>>();
  protected classToTarget = new Map<ClassId, Map<symbol, TargetId>>();

  constructor() {
    super(RootRegistry);
  }

  /**
   * Resolve the target given a qualifier
   * @param target
   * @param qualifier
   */
  protected resolveTarget<T>(target: ClassTarget<T>, qualifier?: symbol, resolution?: ResolutionType): Resolved<T> {
    const qualifiers = this.targetToClass.get(target.ᚕid) ?? new Map<symbol, string>();

    let cls: string | undefined;

    if (qualifier && qualifiers.has(qualifier)) {
      cls = qualifiers.get(qualifier);
    } else {
      const resolved = [...qualifiers.keys()];
      if (!qualifier) {
        // If primary found
        if (qualifiers.has(PrimaryCandidateⲐ)) {
          qualifier = PrimaryCandidateⲐ;
        } else {
          // If there is only one default symbol
          const filtered = resolved.filter(x => !!x).filter(x => this.defaultSymbols.has(x));
          if (filtered.length === 1) {
            qualifier = filtered[0];
          } else if (filtered.length > 1) {
            // If dealing with sub types, prioritize exact matches
            const exact = this.getCandidateTypes(target as Class).filter(x => x.class === target);
            if (exact.length === 1) {
              qualifier = exact[0].qualifier;
            } else {
              if (resolution === 'any') {
                qualifier = filtered[0];
              } else {
                throw new InjectionError('Dependency has multiple candidates', target, filtered);
              }
            }
          }
        }
      }

      if (!qualifier) {
        throw new InjectionError('Dependency not found', target);
      } else if (!qualifiers.has(qualifier)) {
        if (!this.defaultSymbols.has(qualifier) && resolution === 'loose') {
          console.debug('Unable to find specific dependency, falling back to general instance', { qualifier, target: target.ᚕid });
          return this.resolveTarget(target);
        }
        throw new InjectionError('Dependency not found', target, [qualifier]);
      } else {
        cls = qualifiers.get(qualifier!)!;
      }
    }

    const config = this.get(cls!) as InjectableConfig<T>;
    return {
      qualifier,
      config,
      id: (config.factory ? config.target : config.class).ᚕid
    };
  }

  /**
   * Retrieve all dependencies
   */
  protected async fetchDependencies(managed: InjectableConfig, deps?: Dependency[]) {
    if (!deps || !deps.length) {
      return [];
    }

    const promises = deps.map(async x => {
      try {
        return await this.getInstance(x.target, x.qualifier, x.resolution);
      } catch (e) {
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
  protected async resolveFieldDependencies<T>(config: InjectableConfig<T>, instance: T) {
    const keys = Object.keys(config.dependencies.fields ?? {})
      .filter(k => instance[k as keyof T] === undefined); // Filter out already set ones

    // And auto-wire
    if (keys.length) {
      const deps = await this.fetchDependencies(config, keys.map(x => config.dependencies.fields[x]));
      for (let i = 0; i < keys.length; i++) {
        instance[keys[i] as keyof T] = deps[i] as T[keyof T];
      }
    }
  }

  /**
   * Actually construct an instance while resolving the dependencies
   */
  protected async construct<T>(target: ClassTarget<T>, qualifier: symbol): Promise<T> {
    const managed = this.resolveTarget(target, qualifier).config;

    // Only fetch constructor values
    const consValues = await this.fetchDependencies(managed, managed.dependencies.cons);

    // Create instance
    const inst = managed.factory ?
      managed.factory(...consValues) :
      new (managed.class as ConcreteClass<T>)(...consValues);

    // And auto-wire fields
    await this.resolveFieldDependencies(managed, inst);

    // If factory with field properties on the sub class
    if (managed.factory) {
      const resolved = this.get((inst as ClassInstance<T>).constructor);

      if (resolved) {
        await this.resolveFieldDependencies(resolved, inst);
      }
    }

    // Run post construct, if it wasn't passed in, otherwise it was already created
    if (hasPostConstruct(inst) && !consValues.includes(inst)) {
      await inst.postConstruct();
    }

    return inst;
  }

  /**
   * Create the instance
   */
  protected async createInstance<T>(target: ClassTarget<T>, qualifier: symbol) {
    const classId = this.resolveTarget(target, qualifier).id;

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

    console.debug('Creating Instance', { classId });

    return instance;
  }

  /**
   * Destroy an instance
   */
  protected destroyInstance(cls: Class, qualifier: symbol) {
    const classId = cls.ᚕid;

    const activeInstance = this.instances.get(classId)!.get(qualifier);
    if (hasPreDestroy(activeInstance)) {
      activeInstance.preDestroy();
    }

    this.defaultSymbols.delete(qualifier);
    this.instances.get(classId)!.delete(qualifier);
    this.instancePromises.get(classId)!.delete(qualifier);
    this.classToTarget.get(cls.ᚕid)!.delete(qualifier);
    console.debug('On uninstall', { id: cls.ᚕid, qualifier: qualifier.toString(), classId });
  }

  /**
   * Handle initial installation for the entire registry
   */
  override initialInstall() {
    const finalizing = this.pendingFinalize;
    this.pendingFinalize = [];

    for (const cls of finalizing) {
      this.install(cls, { type: 'added', curr: cls });
    }

    return [] as Class[];
  }

  /**
   * Register a cls as pending
   */
  createPending(cls: Class) {
    if (!this.resolved) {
      this.pendingFinalize.push(cls);
    }

    return {
      class: cls,
      target: cls,
      interfaces: [],
      dependencies: {
        fields: {},
        cons: []
      }
    };
  }

  /**
   * Get an instance by type and qualifier
   */
  async getInstance<T>(target: ClassTarget<T>, qual?: symbol, resolution?: ResolutionType): Promise<T> {
    this.verifyInitialized();

    const { id: classId, qualifier } = this.resolveTarget(target, qual, resolution);
    if (!this.instances.has(classId) || !this.instances.get(classId)!.has(qualifier)) {
      await this.createInstance(target, qualifier); // Wait for proxy
    }
    return this.instances.get(classId)!.get(qualifier)! as T;
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
  registerConstructor<T>(cls: Class<T>, dependencies?: Dependency[]) {
    const conf = this.getOrCreatePending(cls);
    conf.dependencies!.cons = dependencies;
  }

  /**
   * Register a property as a dependency
   */
  registerProperty<T>(cls: Class<T>, field: string, dependency: Dependency) {
    const conf = this.getOrCreatePending(cls);
    conf.dependencies!.fields[field] = dependency;
  }

  /**
   * Register a class
   */
  registerClass<T>(cls: Class<T>, pconfig: Partial<InjectableConfig<T>> = {}) {
    const config = this.getOrCreatePending(pconfig.class ?? cls);

    config.class = cls;
    config.qualifier = pconfig.qualifier ?? config.qualifier ?? Symbol.for(cls.ᚕid);
    if (pconfig.interfaces) {
      config.interfaces?.push(...pconfig.interfaces);
    }
    if (pconfig.primary !== undefined) {
      config.primary = pconfig.primary;
    }
    if (pconfig.factory) {
      config.factory = pconfig.factory ?? config.factory;
    }
    if (pconfig.target) {
      config.target = pconfig.target;
    }
    if (pconfig.dependencies) {
      config.dependencies = {
        fields: {},
        ...pconfig.dependencies as Omit<InjectableConfig['dependencies'], 'fields'>
      };
    }
  }

  /**
   * Register a factory configuration
   */
  registerFactory(config: Omit<InjectableFactoryConfig, 'qualifier'> & {
    id: string;
    qualifier?: undefined | symbol;
    fn: (...args: unknown[]) => unknown;
  }) {
    const finalConfig: Partial<InjectableConfig> = {};

    finalConfig.factory = config.fn;
    finalConfig.target = config.target;
    finalConfig.qualifier = config.qualifier;
    if (!finalConfig.qualifier) {
      finalConfig.qualifier = Symbol.for(config.id);
    }
    if (config.primary !== undefined) {
      finalConfig.primary = config.primary;
    }

    finalConfig.dependencies = { fields: {} };

    if (config.dependencies) {
      finalConfig.dependencies.cons = config.dependencies;
    }

    // Create mock cls for DI purposes
    const cls = { ᚕid: config.id } as Class;

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
  override onInstall<T>(cls: Class<T>, e: ChangeEvent<Class<T>>) {
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

      // collect interfaces
      config.interfaces = [
        ...parentConfig.interfaces,
        ...config.interfaces
      ];

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

    if (config.qualifier === Symbol.for(cls.ᚕid)) {
      this.defaultSymbols.add(config.qualifier);
    }

    this.targetToClass.get(targetId)!.set(config.qualifier, classId);
    this.classToTarget.get(classId)!.set(config.qualifier, targetId);

    // If aliased
    for (const el of config.interfaces) {
      if (!this.targetToClass.has(el.ᚕid)) {
        this.targetToClass.set(el.ᚕid, new Map());
      }
      this.targetToClass.get(el.ᚕid)!.set(config.qualifier, classId);
      this.classToTarget.get(classId)!.set(Symbol.for(el.ᚕid), el.ᚕid);

      if (config.primary && (classId === targetId || config.factory)) {
        this.targetToClass.get(el.ᚕid)!.set(PrimaryCandidateⲐ, classId);
      }
    }

    // If targeting self (default @Injectable behavior)
    if ((classId === targetId || config.factory) && (parentConfig || parentClass.ᚕabstract)) {
      const parentId = parentClass.ᚕid;

      if (!this.targetToClass.has(parentId)) {
        this.targetToClass.set(parentId, new Map());
      }

      if (config.primary) {
        this.targetToClass.get(parentId)!.set(PrimaryCandidateⲐ, classId);
      }

      this.targetToClass.get(parentId)!.set(config.qualifier, classId);
      this.classToTarget.get(classId)!.set(config.qualifier, parentId);
    }

    if (config.primary) {
      if (!this.targetToClass.has(classId)) {
        this.targetToClass.set(classId, new Map());
      }
      this.targetToClass.get(classId)!.set(PrimaryCandidateⲐ, classId);

      if (config.factory) {
        this.targetToClass.get(targetId)!.set(PrimaryCandidateⲐ, classId);
      }

      // Register primary if only one interface provided and no parent config
      if (config.interfaces.length === 1 && !parentConfig) {
        const [intf] = config.interfaces;
        if (!this.targetToClass.has(intf.ᚕid)) {
          this.targetToClass.set(intf.ᚕid, new Map());
        }
        this.targetToClass.get(intf.ᚕid)!.set(PrimaryCandidateⲐ, classId);
      }
    }

    return config;
  }

  /**
   * Handle uninstalling a class
   */
  override onUninstallFinalize(cls: Class) {
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
  override onReset() {
    super.onReset();
    this.pendingFinalize = [];
    this.instances.clear();
    this.instancePromises.clear();
    this.targetToClass.clear();
    this.classToTarget.clear();
    this.factories.clear();
  }

  /**
   * Inject fields into instance
   */
  async injectFields<T extends { constructor: Class<T> }>(o: T, cls = o.constructor as Class<T>) {
    this.verifyInitialized();
    // Compute fields to be auto-wired
    return await this.resolveFieldDependencies(this.get(cls), o);
  }
}

export const DependencyRegistry = new $DependencyRegistry();