import {
  Class, Runtime, asConstructable, castTo, classConstruct, describeFunction,
  asFull, castKey, TypedFunction, hasFunction, AppError
} from '@travetto/runtime';
import { MetadataRegistry, RootRegistry, ChangeEvent } from '@travetto/registry';

import { Dependency, InjectableConfig, ClassTarget, InjectableFactoryConfig, PostConstructHandler } from './types';
import { InjectionError } from './error';

class AutoCreate { }
type TargetId = string;
type ClassId = string;
export type Resolved<T> = { config: InjectableConfig<T>, qualifier: symbol, id: string };

export type ResolutionType = 'strict' | 'loose' | 'any';

const PrimaryCandidateSymbol = Symbol.for('@travetto/di:primary');

const hasPostConstruct = hasFunction<{ postConstruct: () => Promise<unknown> }>('postConstruct');
const hasPreDestroy = hasFunction<{ preDestroy: () => Promise<unknown> }>('preDestroy');

/**
 * Dependency registry
 */
class $DependencyRegistry extends MetadataRegistry<InjectableConfig> {
  pendingFinalize: Class[] = [];

  defaultSymbols = new Set<symbol>();

  instances = new Map<TargetId, Map<symbol, unknown>>();
  instancePromises = new Map<TargetId, Map<symbol, Promise<unknown>>>();

  factories = new Map<TargetId, Map<Class, InjectableConfig>>();

  targetToClass = new Map<TargetId, Map<symbol, string>>();
  classToTarget = new Map<ClassId, Map<symbol, TargetId>>();

  constructor() {
    super(RootRegistry);
  }

  /**
   * Resolve the target given a qualifier
   * @param target
   * @param qualifier
   */
  resolveTarget<T>(target: ClassTarget<T>, qualifier?: symbol, resolution?: ResolutionType): Resolved<T> {
    const qualifiers = this.targetToClass.get(target.Ⲑid) ?? new Map<symbol, string>();

    let cls: string | undefined;

    if (qualifier && qualifiers.has(qualifier)) {
      cls = qualifiers.get(qualifier);
    } else {
      const resolved = [...qualifiers.keys()];
      if (!qualifier) {
        // If primary found
        if (qualifiers.has(PrimaryCandidateSymbol)) {
          qualifier = PrimaryCandidateSymbol;
        } else {
          // If there is only one default symbol
          const filtered = resolved.filter(x => !!x).filter(x => this.defaultSymbols.has(x));
          if (filtered.length === 1) {
            qualifier = filtered[0];
          } else if (filtered.length > 1) {
            // If dealing with sub types, prioritize exact matches
            const exact = this
              .getCandidateTypes(castTo<Class>(target))
              .filter(x => x.class === target);
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
          console.debug('Unable to find specific dependency, falling back to general instance', { qualifier, target: target.Ⲑid });
          return this.resolveTarget(target);
        }
        throw new InjectionError('Dependency not found', target, [qualifier]);
      } else {
        cls = qualifiers.get(qualifier!)!;
      }
    }

    const config: InjectableConfig<T> = castTo(this.get(cls!));
    return {
      qualifier,
      config,
      id: (config.factory ? config.target : config.class).Ⲑid
    };
  }

  /**
   * Retrieve all dependencies
   */
  async fetchDependencies<T>(managed: InjectableConfig<T>, deps?: Dependency[], keys?: string[]): Promise<unknown[]> {
    if (!deps || !deps.length) {
      return [];
    }

    const promises = deps.map(async (x, i) => {
      try {
        return await this.getInstance(x.target, x.qualifier, x.resolution);
      } catch (err) {
        if (x.optional && err instanceof InjectionError && err.category === 'notfound') {
          return undefined;
        } else {
          if (err && err instanceof Error) {
            err.message = `${err.message} via=${managed.class.Ⲑid}[${keys?.[i] ?? 'constructor'}]`;
          }
          throw err;
        }
      }
    });

    return await Promise.all(promises);
  }

  /**
   * Resolve all field dependencies
   */
  async resolveFieldDependencies<T>(config: InjectableConfig<T>, instance: T): Promise<void> {
    const keys = Object.keys(config.dependencies.fields ?? {})
      .filter(k => instance[castKey<T>(k)] === undefined); // Filter out already set ones

    // And auto-wire
    if (keys.length) {
      const deps = await this.fetchDependencies(config, keys.map(x => config.dependencies.fields[x]), keys);
      for (let i = 0; i < keys.length; i++) {
        instance[castKey<T>(keys[i])] = castTo(deps[i]);
      }
    }
  }

  /**
   * Actually construct an instance while resolving the dependencies
   */
  async construct<T>(target: ClassTarget<T>, qualifier: symbol): Promise<T> {
    const managed = this.resolveTarget(target, qualifier).config;

    // Only fetch constructor values
    const consValues = await this.fetchDependencies(managed, managed.dependencies.cons);

    // Create instance
    const inst = managed.factory ?
      managed.factory(...consValues) :
      classConstruct(managed.class, consValues);

    // And auto-wire fields
    await this.resolveFieldDependencies(managed, inst);

    // If factory with field properties on the sub class
    if (managed.factory) {
      const resolved = this.get(asConstructable(inst).constructor);

      if (resolved) {
        await this.resolveFieldDependencies(resolved, inst);
      }
    }

    // Run post construct, if it wasn't passed in, otherwise it was already created
    if (hasPostConstruct(inst) && !consValues.includes(inst)) {
      await inst.postConstruct();
    }

    // Run post constructors
    for (const op of Object.values(managed.postConstruct)) {
      await op(inst);
    }

    return inst;
  }

  /**
   * Create the instance
   */
  async createInstance<T>(target: ClassTarget<T>, qualifier: symbol): Promise<T> {
    const classId = this.resolveTarget(target, qualifier).id;

    if (!this.instances.has(classId)) {
      this.instances.set(classId, new Map());
      this.instancePromises.set(classId, new Map());
    }

    if (this.instancePromises.get(classId)!.has(qualifier)) {
      return castTo(this.instancePromises.get(classId)!.get(qualifier));
    }

    const instancePromise = this.construct(target, qualifier);
    this.instancePromises.get(classId)!.set(qualifier, instancePromise);
    try {
      const instance = await instancePromise;
      this.instances.get(classId)!.set(qualifier, instance);
      return instance;
    } catch (err) {
      // Clear it out, don't save failed constructions
      this.instancePromises.get(classId)!.delete(qualifier);
      throw err;
    }
  }

  /**
   * Destroy an instance
   */
  destroyInstance(cls: Class, qualifier: symbol): void {
    const classId = cls.Ⲑid;

    const activeInstance = this.instances.get(classId)!.get(qualifier);
    if (hasPreDestroy(activeInstance)) {
      activeInstance.preDestroy();
    }

    this.defaultSymbols.delete(qualifier);
    this.instances.get(classId)!.delete(qualifier);
    this.instancePromises.get(classId)!.delete(qualifier);
    this.classToTarget.get(classId)!.delete(qualifier);
    console.debug('On uninstall', { id: classId, qualifier: qualifier.toString(), classId });
  }

  override async init(): Promise<void> {
    await super.init();
    if (Runtime.dynamic) {
      const { DependencyRegistration } = await import('../support/dynamic.injection');
      DependencyRegistration.init(this);
    }

    await this.getCandidateInstances(AutoCreate);
  }

  /**
   * Handle initial installation for the entire registry
   */
  override initialInstall(): Class[] {
    const finalizing = this.pendingFinalize;
    this.pendingFinalize = [];

    for (const cls of finalizing) {
      this.install(cls, { type: 'added', curr: cls });
    }

    return [];
  }

  /**
   * Register a cls as pending
   */
  createPending(cls: Class): Partial<InjectableConfig> {
    if (!this.resolved) {
      this.pendingFinalize.push(cls);
    }

    return {
      class: cls,
      enabled: true,
      target: cls,
      interfaces: [],
      dependencies: {
        fields: {},
        cons: []
      },
      postConstruct: {}
    };
  }

  /**
   * Get an instance by type and qualifier
   */
  async getInstance<T>(target: ClassTarget<T>, qual?: symbol, resolution?: ResolutionType): Promise<T> {
    this.verifyInitialized();

    if (!target) {
      throw new AppError('Unable to get instance when target is undefined');
    }

    const { id: classId, qualifier } = this.resolveTarget(target, qual, resolution);
    if (!this.instances.has(classId) || !this.instances.get(classId)!.has(qualifier)) {
      await this.createInstance(target, qualifier); // Wait for proxy
    }
    return castTo(this.instances.get(classId)!.get(qualifier));
  }

  /**
   * Get all available candidate types for the target
   */
  getCandidateTypes<T>(target: Class<T>): InjectableConfig<T>[] {
    const qualifiers = this.targetToClass.get(target.Ⲑid)!;
    const uniqueQualifiers = qualifiers ? Array.from(new Set(qualifiers.values())) : [];
    return castTo(uniqueQualifiers.map(id => this.get(id)));
  }

  /**
   * Get candidate instances by target type, with an optional filter
   */
  getCandidateInstances<T>(target: Class<T>, predicate?: (cfg: InjectableConfig<T>) => boolean): Promise<T[]> {
    const inputs = this.getCandidateTypes<T>(target).filter(x => !predicate || predicate(x));
    return Promise.all(inputs.map(l => this.getInstance<T>(l.class, l.qualifier)));
  }

  /**
   * Register a constructor with dependencies
   */
  registerConstructor<T>(cls: Class<T>, dependencies?: Dependency[]): void {
    const conf = this.getOrCreatePending(cls);
    conf.dependencies!.cons = dependencies;
  }

  /**
   * Register a post construct handler
   */
  registerPostConstructHandler<T>(cls: Class<T>, name: string, handler: PostConstructHandler<T>): void {
    const conf = this.getOrCreatePending(cls);
    conf.postConstruct![name] = castTo(handler);
  }

  /**
   * Register a property as a dependency
   */
  registerProperty<T>(cls: Class<T>, field: string, dependency: Dependency): void {
    const conf = this.getOrCreatePending(cls);
    conf.dependencies!.fields[field] = dependency;
  }

  /**
   * Register a class
   */
  registerClass<T>(cls: Class<T>, pConfig: Partial<InjectableConfig<T>> = {}): void {
    const config = this.getOrCreatePending(pConfig.class ?? cls);

    config.enabled = pConfig.enabled ?? config.enabled;
    config.class = cls;
    config.qualifier = pConfig.qualifier ?? config.qualifier ?? Symbol.for(cls.Ⲑid);
    if (pConfig.interfaces) {
      (config.interfaces ??= []).push(...pConfig.interfaces);
    }
    if (pConfig.primary !== undefined) {
      config.primary = pConfig.primary;
    }
    if (pConfig.factory) {
      config.factory = pConfig.factory ?? config.factory;
    }
    if (pConfig.target) {
      config.target = pConfig.target;
    }
    if (pConfig.dependencies) {
      config.dependencies = {
        ...pConfig.dependencies,
        fields: {
          ...pConfig.dependencies.fields
        }
      };
    }
    if (pConfig.autoCreate) {
      (config.interfaces ??= []).push(AutoCreate);
    }
  }

  /**
   * Register a factory configuration
   */
  registerFactory(config: Omit<InjectableFactoryConfig, 'qualifier'> & {
    id: string;
    qualifier?: undefined | symbol;
    fn: TypedFunction;
  }): void {
    const finalConfig: Partial<InjectableConfig> = {};

    finalConfig.enabled = config.enabled ?? true;
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
    const fnClass = class { static Ⲑid = config.id; };

    finalConfig.class = fnClass;

    this.registerClass(fnClass, finalConfig);

    const srcClassId = config.src.Ⲑid;

    if (!this.factories.has(srcClassId)) {
      this.factories.set(srcClassId, new Map());
    }

    this.factories.get(srcClassId)!.set(fnClass, asFull(finalConfig));
  }

  /**
   * On Install event
   */
  override onInstall<T>(cls: Class<T>, e: ChangeEvent<Class<T>>): void {
    super.onInstall(cls, e);
    const classId = cls.Ⲑid;

    // Install factories separate from classes
    if (this.factories.has(classId)) {
      for (const fact of this.factories.get(classId)!.keys()) {
        this.onInstall(fact, e);
      }
    }
  }

  /**
   * Handle installing a class
   */
  onInstallFinalize<T>(cls: Class<T>): InjectableConfig<T> {
    const classId = cls.Ⲑid;

    const config: InjectableConfig<T> = castTo(this.getOrCreatePending(cls));

    if (config.enabled !== undefined && !(typeof config.enabled === 'boolean' ? config.enabled : config.enabled())) {
      return config; // Do not setup if disabled
    }

    // Allow for the factory to fulfill the target
    let parentClass: Function = config.factory ? config.target : Object.getPrototypeOf(cls);

    if (config.factory) {
      while (describeFunction(Object.getPrototypeOf(parentClass))?.abstract) {
        parentClass = Object.getPrototypeOf(parentClass);
      }
      if (!this.targetToClass.has(classId)) {
        this.targetToClass.set(classId, new Map());
      }
      // Make explicitly discoverable as self
      this.targetToClass.get(classId)?.set(config.qualifier, classId);
    }

    const parentConfig = this.get(parentClass.Ⲑid);

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

      config.postConstruct = {
        ...parentConfig.postConstruct,
        ...config.postConstruct
      };

      // Inherit cons deps if no constructor defined
      if (config.dependencies.cons === undefined) {
        config.dependencies.cons = parentConfig.dependencies.cons;
      }
    }

    if (describeFunction(cls)?.abstract) { // Skip out early, only needed to inherit
      return config;
    }

    if (!this.classToTarget.has(classId)) {
      this.classToTarget.set(classId, new Map());
    }

    const targetClassId = config.target.Ⲑid;

    if (!this.targetToClass.has(targetClassId)) {
      this.targetToClass.set(targetClassId, new Map());
    }

    if (config.qualifier === Symbol.for(classId)) {
      this.defaultSymbols.add(config.qualifier);
    }

    this.targetToClass.get(targetClassId)!.set(config.qualifier, classId);
    this.classToTarget.get(classId)!.set(config.qualifier, targetClassId);

    // If aliased
    for (const el of config.interfaces) {
      const elClassId = el.Ⲑid;
      if (!this.targetToClass.has(elClassId)) {
        this.targetToClass.set(elClassId, new Map());
      }
      this.targetToClass.get(elClassId)!.set(config.qualifier, classId);
      this.classToTarget.get(classId)!.set(Symbol.for(elClassId), elClassId);

      if (config.primary && (classId === targetClassId || config.factory)) {
        this.targetToClass.get(elClassId)!.set(PrimaryCandidateSymbol, classId);
      }
    }

    // If targeting self (default @Injectable behavior)
    if ((classId === targetClassId || config.factory) && (parentConfig || describeFunction(parentClass)?.abstract)) {
      const parentId = parentClass.Ⲑid;

      if (!this.targetToClass.has(parentId)) {
        this.targetToClass.set(parentId, new Map());
      }

      if (config.primary) {
        this.targetToClass.get(parentId)!.set(PrimaryCandidateSymbol, classId);
      }

      this.targetToClass.get(parentId)!.set(config.qualifier, classId);
      this.classToTarget.get(classId)!.set(config.qualifier, parentId);
    }

    if (config.primary) {
      if (!this.targetToClass.has(classId)) {
        this.targetToClass.set(classId, new Map());
      }
      this.targetToClass.get(classId)!.set(PrimaryCandidateSymbol, classId);

      if (config.factory) {
        this.targetToClass.get(targetClassId)!.set(PrimaryCandidateSymbol, classId);
      }

      // Register primary if only one interface provided and no parent config
      if (config.interfaces.length === 1 && !parentConfig) {
        const [primaryInterface] = config.interfaces;
        const primaryClassId = primaryInterface.Ⲑid;
        if (!this.targetToClass.has(primaryClassId)) {
          this.targetToClass.set(primaryClassId, new Map());
        }
        this.targetToClass.get(primaryClassId)!.set(PrimaryCandidateSymbol, classId);
      }
    }

    return config;
  }

  /**
   * Handle uninstalling a class
   */
  override onUninstallFinalize(cls: Class): void {
    const classId = cls.Ⲑid;

    if (!this.classToTarget.has(classId)) {
      return;
    }

    if (this.instances.has(classId)) {
      for (const qualifier of this.classToTarget.get(classId)!.keys()) {
        this.destroyInstance(cls, qualifier);
      }
    }
  }

  /**
   * Inject fields into instance
   */
  async injectFields<T extends { constructor: Class<T> }>(o: T, cls = o.constructor): Promise<void> {
    this.verifyInitialized();
    // Compute fields to be auto-wired
    return await this.resolveFieldDependencies(this.get(cls), o);
  }

  /**
   * Execute the run method of a given class
   */
  async runInstance<T extends { run(..._args: unknown[]): unknown }>(
    cls: Class<T>, ...args: Parameters<T['run']>
  ): Promise<Awaited<ReturnType<T['run']>>> {
    await RootRegistry.init();
    const inst = await this.getInstance<T>(cls);
    return castTo<Awaited<ReturnType<T['run']>>>(inst.run(...args));
  }
}

export const DependencyRegistry = new $DependencyRegistry();