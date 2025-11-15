import { ChangeEvent, ClassOrId, RegistryIndex, RegistryV2, RetargettingProxy } from '@travetto/registry';
import { AppError, castKey, castTo, Class, classConstruct, describeFunction, getParentClass, Runtime } from '@travetto/runtime';
import { SchemaFieldConfig, SchemaParameterConfig, SchemaRegistryIndex } from '@travetto/schema';

import { ClassTarget, Dependency, InjectableConfig } from '../types';
import { DependencyRegistryAdapter } from './registry-adapter';
import { DependencyClassId, DependencyTargetId, hasPostConstruct, hasPreDestroy, PrimaryCandidateSymbol, ResolutionType, Resolved } from './types';
import { InjectionError } from '../error';


export class DependencyRegistryIndex implements RegistryIndex<InjectableConfig> {
  static adapterCls = DependencyRegistryAdapter;

  static getForRegister(clsOrId: ClassOrId): DependencyRegistryAdapter {
    return RegistryV2.getForRegister(this, clsOrId);
  }

  static getInstance<T>(target: ClassTarget<T>, qualifier?: symbol, resolution?: ResolutionType): Promise<T> {
    return RegistryV2.instance(DependencyRegistryIndex).getInstance(target, qualifier, resolution);
  }

  static getCandidateTypes<T>(target: Class<T>): InjectableConfig<T>[] {
    return RegistryV2.instance(DependencyRegistryIndex).getCandidateTypes<T>(target);
  }

  static getCandidateInstances<T>(target: Class<T>, predicate?: (cfg: InjectableConfig<T>) => boolean): Promise<T[]> {
    return RegistryV2.instance(DependencyRegistryIndex).getCandidateInstances<T>(target, predicate);
  }

  static injectFields<T extends { constructor: Class<T> }>(o: T, cls = o.constructor): Promise<void> {
    return RegistryV2.instance(DependencyRegistryIndex).injectFields(o, cls);
  }

  static async getPrimaryCandidateInstances<T>(candidateType: Class<T>): Promise<[Class, T][]> {
    const targets = await DependencyRegistryIndex.getCandidateTypes(candidateType);
    return await Promise.all(
      targets
        .filter(el => el.qualifier === RegistryV2.get(DependencyRegistryIndex, el.class).get().qualifier) // Is primary?
        .toSorted((a, b) => a.class.name.localeCompare(b.class.name))
        .map(async el => {
          const instance = await DependencyRegistryIndex.getInstance<T>(el.class, el.qualifier);
          return [el.class, instance];
        })
    );
  }

  #defaultSymbols = new Set<symbol>();

  #instances = new Map<DependencyTargetId, Map<symbol, unknown>>();
  #instancePromises = new Map<DependencyTargetId, Map<symbol, Promise<unknown>>>();
  #proxies = new Map<string, Map<symbol | undefined, RetargettingProxy<unknown>>>();

  #targetToClass = new Map<DependencyTargetId, Map<symbol, string>>();
  #classToTarget = new Map<DependencyClassId, Map<symbol, DependencyTargetId>>();

  #proxyInstance<T>(target: ClassTarget<unknown>, qualifier: symbol, instance: T): T {
    const classId = target.Ⲑid;
    let proxy: RetargettingProxy<unknown>;

    if (!this.#proxies.has(classId)) {
      this.#proxies.set(classId, new Map());
    }

    if (!this.#proxies.get(classId)!.has(qualifier)) {
      proxy = new RetargettingProxy(instance);
      this.#proxies.get(classId)!.set(qualifier, proxy);
      console.debug('Registering proxy', { id: target.Ⲑid, qualifier: qualifier.toString() });
    } else {
      proxy = this.#proxies.get(classId)!.get(qualifier)!;
      proxy.setTarget(instance);
      console.debug('Updating target', {
        id: target.Ⲑid, qualifier: qualifier.toString(), instanceType: target.name
      });
    }

    return proxy.get();
  }

  #addClass(cls: Class): void {
    const classId = cls.Ⲑid;

    const adapter = RegistryV2.get(DependencyRegistryIndex, cls);
    if (!adapter.enabled()) {
      return;
    }

    const config = adapter.get();
    const parentClass = this.getParentClass(cls);

    if (config.factory) {
      if (!this.#targetToClass.has(classId)) {
        this.#targetToClass.set(classId, new Map());
      }
      // Make explicitly discoverable as self
      this.#targetToClass.get(classId)?.set(config.qualifier, classId);
    }

    if (describeFunction(cls)?.abstract) { // Skip out early, only needed to inherit
      return;
    }

    if (!this.#classToTarget.has(classId)) {
      this.#classToTarget.set(classId, new Map());
    }

    const targetClassId = (config.target ?? config.class).Ⲑid;

    if (!this.#targetToClass.has(targetClassId)) {
      this.#targetToClass.set(targetClassId, new Map());
    }

    if (config.qualifier === Symbol.for(classId)) {
      this.#defaultSymbols.add(config.qualifier);
    }

    this.#targetToClass.get(targetClassId)!.set(config.qualifier, classId);
    this.#classToTarget.get(classId)!.set(config.qualifier, targetClassId);

    // If aliased
    const { interfaces } = SchemaRegistryIndex.getConfig(cls);
    for (const el of interfaces) {
      const elClassId = el.Ⲑid;
      if (!this.#targetToClass.has(elClassId)) {
        this.#targetToClass.set(elClassId, new Map());
      }
      this.#targetToClass.get(elClassId)!.set(config.qualifier, classId);
      this.#classToTarget.get(classId)!.set(Symbol.for(elClassId), elClassId);

      if (config.primary && (classId === targetClassId || config.factory)) {
        this.#targetToClass.get(elClassId)!.set(PrimaryCandidateSymbol, classId);
      }
    }

    const parentConfig = RegistryV2.get(DependencyRegistryIndex, parentClass).get();


    // If targeting self (default @Injectable behavior)
    if ((classId === targetClassId || config.factory) && (parentConfig || describeFunction(parentClass)?.abstract)) {
      const parentId = parentClass.Ⲑid;

      if (!this.#targetToClass.has(parentId)) {
        this.#targetToClass.set(parentId, new Map());
      }

      if (config.primary) {
        this.#targetToClass.get(parentId)!.set(PrimaryCandidateSymbol, classId);
      }

      this.#targetToClass.get(parentId)!.set(config.qualifier, classId);
      this.#classToTarget.get(classId)!.set(config.qualifier, parentId);
    }

    if (config.primary) {
      if (!this.#targetToClass.has(classId)) {
        this.#targetToClass.set(classId, new Map());
      }
      this.#targetToClass.get(classId)!.set(PrimaryCandidateSymbol, classId);

      if (config.factory) {
        this.#targetToClass.get(targetClassId)!.set(PrimaryCandidateSymbol, classId);
      }

      // Register primary if only one interface provided and no parent config
      if (interfaces.length === 1 && !parentConfig) {
        const [primaryInterface] = interfaces;
        const primaryClassId = primaryInterface.Ⲑid;
        if (!this.#targetToClass.has(primaryClassId)) {
          this.#targetToClass.set(primaryClassId, new Map());
        }
        this.#targetToClass.get(primaryClassId)!.set(PrimaryCandidateSymbol, classId);
      }
    }
  }

  #changedClass(cls: Class, _prev: Class): void {
    // Reload instances
    for (const qualifier of this.#proxies.get(cls.Ⲑid)?.keys() ?? []) {
      // Timing matters due to create instance being asynchronous
      process.nextTick(() => this.getInstance(cls, qualifier));
    }
  }

  #removeClass(cls: Class): void {
    const classId = cls.Ⲑid;

    if (!this.#classToTarget.has(classId)) {
      return;
    }

    if (this.#instances.has(classId)) {
      for (const qualifier of this.#classToTarget.get(classId)!.keys()) {
        this.destroyInstance(cls, qualifier);
      }
    }
  }

  getParentClass(cls: Class): Class {
    const config = RegistryV2.get(DependencyRegistryIndex, cls).get();
    let parentClass = config.factory ? config.target : (getParentClass(cls) ?? Object);

    if (config.factory) {
      while (describeFunction(Object.getPrototypeOf(parentClass))?.abstract) {
        parentClass = Object.getPrototypeOf(parentClass);
      }
    }
    return castTo(parentClass);
  }

  getConfig(clsOrId: ClassOrId): InjectableConfig {
    return RegistryV2.get(DependencyRegistryIndex, clsOrId).get();
  }

  process(events: ChangeEvent<Class>[]): void {
    for (const ev of events) {
      if (ev.type === 'added') {
        this.#addClass(ev.curr);
      } else if (ev.type === 'removing') {
        this.#removeClass(ev.prev);
      } else if (ev.type === 'changed') {
        this.#changedClass(ev.curr, ev.prev);
      }
    }
  }

  /**
   * Get all available candidate types for the target
   */
  getCandidateTypes<T>(target: Class<T>): InjectableConfig<T>[] {
    const qualifiers = this.#targetToClass.get(target.Ⲑid)!;
    const uniqueQualifiers = qualifiers ? Array.from(new Set(qualifiers.values())) : [];
    return castTo(uniqueQualifiers.map(id => this.getConfig(id)));
  }

  /**
   * Get candidate instances by target type, with an optional filter
   */
  getCandidateInstances<T>(target: Class<T>, predicate?: (cfg: InjectableConfig<T>) => boolean): Promise<T[]> {
    const inputs = this.getCandidateTypes<T>(target).filter(x => !predicate || predicate(x));
    return Promise.all(inputs.map(l => this.getInstance<T>(l.class, l.qualifier)));
  }

  /**
   * Resolve the target given a qualifier
   * @param target
   * @param qualifier
   */
  resolveTarget<T>(target: ClassTarget<T>, qualifier?: symbol, resolution?: ResolutionType): Resolved<T> {
    const qualifiers = this.#targetToClass.get(target.Ⲑid) ?? new Map<symbol, string>();

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
          const filtered = resolved.filter(x => !!x).filter(x => this.#defaultSymbols.has(x));
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
        if (!this.#defaultSymbols.has(qualifier) && resolution === 'loose') {
          console.debug('Unable to find specific dependency, falling back to general instance', { qualifier, target: target.Ⲑid });
          return this.resolveTarget(target);
        }
        throw new InjectionError('Dependency not found', target, [qualifier]);
      } else {
        cls = qualifiers.get(qualifier!)!;
      }
    }

    const config: InjectableConfig<T> = castTo(this.getConfig(cls!));
    return {
      qualifier,
      config,
      id: (config.target ?? config.class).Ⲑid
    };
  }

  /**
   * Retrieve all dependencies
   */
  async fetchDependencies<T>(managed: InjectableConfig<T>, deps: Dependency[], inputs: (SchemaFieldConfig | SchemaParameterConfig)[]): Promise<unknown[]> {
    if (!deps || !deps.length) {
      return [];
    }

    const promises = deps.map(async (x, i) => {
      try {
        const target = x.target ?? inputs[i].type;
        return await this.getInstance(target, x.qualifier, x.resolution);
      } catch (err) {
        if (inputs[i].required?.active === false && err instanceof InjectionError && err.category === 'notfound') {
          return undefined;
        } else {
          if (err && err instanceof Error) {
            err.message = `${err.message} via=${managed.class.Ⲑid}[${inputs[i].name?.toString() ?? 'constructor'}]`;
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

    const schema = SchemaRegistryIndex.getSchemaConfig(config.class);

    // And auto-wire
    if (keys.length) {
      const deps = await this.fetchDependencies(
        config,
        keys.map(x => config.dependencies.fields[x]),
        keys.map(x => schema[x])
      );
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
    const consValues = await this.fetchDependencies(
      managed,
      managed.dependencies.cons ?? [],
      SchemaRegistryIndex.getMethodConfig(managed.class, 'constructor').parameters
    );

    // Create instance
    const inst = managed.factory ?
      managed.factory(...consValues) :
      classConstruct(managed.class, consValues);

    // And auto-wire fields
    await this.resolveFieldDependencies(managed, inst);

    // If factory with field properties on the sub class
    if (managed.factory) {
      const resolved = this.getConfig(inst);

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

    // Proxy if necessary
    return Runtime.dynamic ? this.#proxyInstance(target, qualifier, inst) : inst;
  }

  /**
   * Get or create the instance
   */
  async getInstance<T>(target: ClassTarget<T>, requestedQualifier?: symbol, resolution?: ResolutionType): Promise<T> {
    if (!target) {
      throw new AppError('Unable to get instance when target is undefined');
    }

    const { id: classId, qualifier } = this.resolveTarget(target, requestedQualifier, resolution);

    if (!this.#instances.has(classId)) {
      this.#instances.set(classId, new Map());
      this.#instancePromises.set(classId, new Map());
    }

    if (this.#instancePromises.get(classId)!.has(qualifier)) {
      return castTo(this.#instancePromises.get(classId)!.get(qualifier));
    }

    const instancePromise = this.construct(target, qualifier);
    this.#instancePromises.get(classId)!.set(qualifier, instancePromise);
    try {
      const instance = await instancePromise;
      this.#instances.get(classId)!.set(qualifier, instance);
      return instance;
    } catch (err) {
      // Clear it out, don't save failed constructions
      this.#instancePromises.get(classId)!.delete(qualifier);
      throw err;
    }
  }

  /**
   * Destroy an instance
   */
  destroyInstance(cls: Class, qualifier: symbol): void {
    const classId = cls.Ⲑid;

    const activeInstance = this.#instances.get(classId)!.get(qualifier);
    if (hasPreDestroy(activeInstance)) {
      activeInstance.preDestroy();
    }

    this.#defaultSymbols.delete(qualifier);
    this.#instances.get(classId)!.delete(qualifier);
    this.#instancePromises.get(classId)!.delete(qualifier);
    this.#classToTarget.get(classId)!.delete(qualifier);
    // May not exist
    this.#proxies.get(classId)?.get(qualifier)?.setTarget(null);
    console.debug('On uninstall', { id: classId, qualifier: qualifier.toString(), classId });
  }

  /**
   * Inject fields into instance
   */
  async injectFields<T extends { constructor: Class<T> }>(o: T, cls = o.constructor): Promise<void> {
    // Compute fields to be auto-wired
    return await this.resolveFieldDependencies(this.getConfig(cls), o);
  }
}