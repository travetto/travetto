import { ChangeEvent, ClassOrId, RegistryIndexStore, RegistryV2, RetargettingProxy } from '@travetto/registry';
import { AppError, castKey, castTo, Class, classConstruct, describeFunction, getParentClass, Runtime, Util } from '@travetto/runtime';
import { SchemaFieldConfig, SchemaParameterConfig, SchemaRegistryIndex } from '@travetto/schema';

import { ClassTarget, Dependency, InjectionClassConfig, ResolutionType } from '../types';
import { DependencyRegistryAdapter } from './registry-adapter';
import { DependencyTargetId, hasPostConstruct, hasPreDestroy } from './types';
import { InjectionError } from '../error';
import { DependencyRegistryResolver } from './registry-resolver';

export class DependencyRegistryIndex {

  static { RegistryV2.registerIndex(DependencyRegistryIndex); }

  static get instance(): DependencyRegistryIndex {
    return RegistryV2.instance(this);
  }

  static getForRegister(clsOrId: ClassOrId): DependencyRegistryAdapter {
    return this.instance.store.getForRegister(clsOrId);
  }

  static getInstance<T>(target: ClassTarget<T>, qualifier?: symbol, resolution?: ResolutionType): Promise<T> {
    return this.instance.getInstance(target, qualifier, resolution);
  }

  static getCandidateTypes<T>(target: Class<T>): InjectionClassConfig<T>[] {
    return this.instance.getCandidateTypes<T>(target);
  }

  static getCandidateInstances<T>(target: Class<T>, predicate?: (cfg: InjectionClassConfig<T>) => boolean): Promise<T[]> {
    return this.instance.getCandidateInstances<T>(target, predicate);
  }

  static injectFields<T extends { constructor: Class<T> }>(o: T, cls = o.constructor): Promise<void> {
    return this.instance.injectFields(o, cls);
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

  #instances = new Map<DependencyTargetId, Map<symbol, unknown>>();
  #instancePromises = new Map<DependencyTargetId, Map<symbol, Promise<unknown>>>();
  #proxies = new Map<string, Map<symbol | undefined, RetargettingProxy<unknown>>>();

  #resolver = new DependencyRegistryResolver();

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
    const adapter = this.store.get(cls);
    if (
      !adapter.enabled() ||
      describeFunction(cls)?.abstract  // Skip out early, only needed to inherit
    ) {
      return;
    }

    for (const item of adapter.getInjectables()) {
      const parentClass = this.getParentClass(cls);
      const parentConfig = parentClass ? RegistryV2.getOptional(DependencyRegistryIndex, parentClass) : undefined;
      const hasParentBase = (parentConfig || describeFunction(parentClass)?.abstract);
      const baseParentId = hasParentBase ? parentClass?.Ⲑid : undefined;
      this.#resolver.registerClass(item, baseParentId, parentConfig?.get());
    }
  }

  #changedClass(cls: Class, _prev: Class): void {
    // Reload instances
    for (const qualifier of this.#proxies.get(cls.Ⲑid)?.keys() ?? []) {
      // Timing matters due to create instance being asynchronous
      Util.queueMacroTask().then(() => { this.getInstance(cls, qualifier); });
    }
  }

  #removeClass(cls: Class): void {
    const classId = cls.Ⲑid;

    if (this.#instances.has(classId)) {
      for (const qualifier of this.#resolver.getQualifiers(cls)) {
        this.destroyInstance(cls, qualifier);
      }
    }
  }

  store = new RegistryIndexStore(DependencyRegistryAdapter);

  getParentClass(cls: Class): Class {
    const config = this.getConfig(cls);
    if (config.factory) {
      let parentClass = config.target;
      while (describeFunction(Object.getPrototypeOf(parentClass))?.abstract) {
        parentClass = Object.getPrototypeOf(parentClass);
      }
      return castTo(parentClass);
    } else {
      return getParentClass(cls) ?? Object;
    }
  }

  getConfig(clsOrId: ClassOrId): InjectionClassConfig {
    return this.store.get(clsOrId).get();
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
  getCandidateTypes<T>(target: Class<T>): InjectionClassConfig<T>[] {
    return castTo(this.#resolver.getQualifiers(target).map(id => this.getConfig(id)));
  }

  /**
   * Get candidate instances by target type, with an optional filter
   */
  getCandidateInstances<T>(target: Class<T>, predicate?: (cfg: InjectionClassConfig<T>) => boolean): Promise<T[]> {
    const inputs = this.getCandidateTypes<T>(target).filter(x => !predicate || predicate(x));
    return Promise.all(inputs.map(l => this.getInstance<T>(l.class, l.qualifier)));
  }



  /**
   * Retrieve all dependencies
   */
  async fetchDependencies<T>(managed: InjectionClassConfig<T>, deps: Dependency[], inputs: (SchemaFieldConfig | SchemaParameterConfig)[]): Promise<unknown[]> {
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
  async resolveFieldDependencies<T>(config: InjectionClassConfig<T>, instance: T): Promise<void> {
    const keys = Object.keys(config.dependencies.fields ?? {})
      .filter(k => instance[castKey<T>(k)] === undefined); // Filter out already set ones

    const fields = SchemaRegistryIndex.getFieldMap(config.class);

    // And auto-wire
    if (keys.length) {
      const deps = await this.fetchDependencies(
        config,
        keys.map(x => config.dependencies.fields[x]),
        keys.map(x => fields[x])
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
    const managed = this.#resolver.resolveTarget(target, qualifier).config;

    // Only fetch constructor values
    const consValues = await this.fetchDependencies(
      managed,
      managed.dependencies.cons ?? [],
      SchemaRegistryIndex.getMethodConfig(managed.class, 'constructor').parameters
    );

    // Create instance
    const inst = managed.factory ?
      managed.factory.handle(...consValues) :
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

    const { id: classId, qualifier } = this.#resolver.resolveTarget(target, requestedQualifier, resolution);

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

    this.#resolver.removeClass(cls, qualifier);
    this.#instances.get(classId)!.delete(qualifier);
    this.#instancePromises.get(classId)!.delete(qualifier);

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