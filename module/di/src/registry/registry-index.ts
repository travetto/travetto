import { ChangeEvent, ClassOrId, RegistryIndexStore, RegistryV2, RetargettingProxy } from '@travetto/registry';
import { AppError, castKey, castTo, Class, describeFunction, getParentClass, Runtime, TypedObject, Util } from '@travetto/runtime';
import { SchemaFieldConfig, SchemaParameterConfig, SchemaRegistryIndex } from '@travetto/schema';

import { ClassTarget, Dependency, InjectableCandidateConfig, InjectableClassMetadata, InjectableConfig, ResolutionType } from '../types';
import { DependencyRegistryAdapter } from './registry-adapter';
import { DependencyTargetId, hasPostConstruct, hasPreDestroy, PrimaryCandidateSymbol } from './types';
import { InjectionError } from '../error';
import { DependencyRegistryResolver } from './registry-resolver';

const MetadataSymbol = Symbol();

function readDependency(item: { metadata?: Record<symbol, unknown> }): Dependency | undefined {
  return item.metadata?.[MetadataSymbol] as Dependency | undefined;
}

export class DependencyRegistryIndex {

  static #instance = RegistryV2.registerIndex(DependencyRegistryIndex);

  static getForRegister(clsOrId: ClassOrId): DependencyRegistryAdapter {
    return this.#instance.store.getForRegister(clsOrId);
  }

  static getInstance<T>(target: ClassTarget<T>, qualifier?: symbol, resolution?: ResolutionType): Promise<T> {
    return this.#instance.getInstance(target, qualifier, resolution);
  }

  static getCandidates<T>(target: Class<T>): InjectableCandidateConfig<T>[] {
    return this.#instance.getCandidates<T>(target);
  }

  static getCandidateInstances<T>(target: Class<T>, predicate?: (cfg: InjectableCandidateConfig<T>) => boolean): Promise<T[]> {
    return this.#instance.getCandidateInstances<T>(target, predicate);
  }

  static injectFields<T extends { constructor: Class<T> }>(o: T, cls = o.constructor): Promise<T> {
    return this.#instance.injectFields(cls, o);
  }

  static getOptional(clsOrId: ClassOrId): InjectableConfig | undefined {
    return this.#instance.store.getOptional(clsOrId)?.get();
  }

  static async getPrimaryCandidateInstances<T>(candidateType: Class<T>): Promise<[Class, T][]> {
    return this.#instance.getPrimaryCandidateInstances<T>(candidateType);
  }

  static registerClassMetadata(clsOrId: ClassOrId, metadata: InjectableClassMetadata): void {
    SchemaRegistryIndex.getForRegister(clsOrId).registerMetadata<InjectableClassMetadata>(MetadataSymbol, metadata);
  }

  static registerParameterMetadata(clsOrId: ClassOrId, method: string | symbol, index: number, metadata: Dependency): void {
    SchemaRegistryIndex.getForRegister(clsOrId).registerParameterMetadata(method, index, MetadataSymbol, metadata);
  }

  static registerFieldMetadata(clsOrId: ClassOrId, field: string | symbol, metadata: Dependency): void {
    SchemaRegistryIndex.getForRegister(clsOrId).registerFieldMetadata(field, MetadataSymbol, metadata);
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

    for (const item of adapter.getInjectables()) {
      if (
        (item.enabled === false || (typeof item.enabled === 'function') && !item.enabled()) ||
        describeFunction(item.candidateType)?.abstract  // Skip out early, only needed to inherit
      ) {
        return;
      }

      const parentClass = getParentClass(item.candidateType);
      const parentConfig = parentClass ? this.store.getOptional(parentClass) : undefined;
      const hasParentBase = (parentConfig || (parentClass && !!describeFunction(parentClass)?.abstract));
      const baseParentId = hasParentBase ? parentClass?.Ⲑid : undefined;
      this.#resolver.registerClass(item, baseParentId);
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
      for (const [qualifier] of this.#resolver.getCandidateEntries(cls)) {
        this.destroyInstance(cls, qualifier);
      }
    }
  }

  store = new RegistryIndexStore(DependencyRegistryAdapter);

  getConfig(clsOrId: ClassOrId): InjectableConfig {
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

  finalize(cls: Class): void {
    this.store.finalize(cls);
  }

  /**
   * Get all available candidates for a given type
   */
  getCandidates<T>(candidateType: Class<T>): InjectableCandidateConfig<T>[] {
    return this.#resolver.getCandidateEntries(candidateType).map(([_, x]) => castTo<InjectableCandidateConfig<T>>(x));
  }

  /**
   * Get candidate instances by target type, with an optional filter
   */
  getCandidateInstances<T>(candidateType: Class<T>, predicate?: (cfg: InjectableCandidateConfig<T>) => boolean): Promise<T[]> {
    const inputs = this.getCandidates<T>(candidateType).filter(x => !predicate || predicate(x));
    return Promise.all(inputs.map(l => this.getInstance<T>(l.class, l.qualifier)));
  }

  async getPrimaryCandidateInstances<T>(candidateType: Class<T>): Promise<[Class, T][]> {
    const targets = await this.getCandidates(candidateType);
    return await Promise.all(
      targets
        .filter(el => el.qualifier === PrimaryCandidateSymbol) // Is primary?
        .toSorted((a, b) => a.class.name.localeCompare(b.class.name))
        .map(async el => {
          const instance = await this.getInstance<T>(el.class, el.qualifier);
          return [el.class, instance];
        })
    );
  }

  async #resolveDependencyValue(x: Dependency, input: SchemaFieldConfig | SchemaParameterConfig, src: Class): Promise<unknown> {
    try {
      const target = x.target ?? input.type;
      return await this.getInstance(target, x.qualifier, x.resolution);
    } catch (err) {
      if (input.required?.active === false && err instanceof InjectionError && err.category === 'notfound') {
        return undefined;
      } else {
        if (err && err instanceof Error) {
          err.message = `${err.message} via=${src.Ⲑid}[${input.name?.toString() ?? 'constructor'}]`;
        }
        throw err;
      }
    }
  }

  /**
   * Retrieve list dependencies
   */
  async fetchDependencyParameters<T>(candidate: InjectableCandidateConfig<T>): Promise<unknown[]> {
    const inputs = SchemaRegistryIndex.getMethodConfig(candidate.class, candidate.method).parameters;

    const promises = inputs
      .map(input => this.#resolveDependencyValue(readDependency(input) ?? {}, input, candidate.class));

    return await Promise.all(promises);
  }

  /**
   * Retrieve mapped dependencies
   */
  async injectFields<T>(candidate: InjectableCandidateConfig<T> | Class, instance: T): Promise<T> {
    let candidateType = 'candidateType' in candidate ? candidate.candidateType : candidate;
    let srcClass = 'candidateType' in candidate ? candidate.class : candidate;

    const inputs = SchemaRegistryIndex.getFieldMap(candidateType);

    const promises = TypedObject.entries(inputs)
      .filter(([k, input]) => instance[castKey(k)] === undefined && readDependency(input) !== undefined)
      .map(async ([k, input]) => [k, await this.#resolveDependencyValue(readDependency(input) ?? {}, input, srcClass)] as const);

    const pairs = await Promise.all(promises);

    for (const [k, v] of pairs) {
      instance[castKey(k)] = castTo(v);
    }
    return instance;
  }

  /**
   * Actually construct an instance while resolving the dependencies
   */
  async construct<T>(target: ClassTarget<T>, qualifier: symbol): Promise<T> {
    const { candidate } = this.#resolver.resolveTarget(target, qualifier);
    const params = await this.fetchDependencyParameters(candidate);
    const inst = await candidate.factory(params);

    // And auto-wire fields
    await this.injectFields(candidate, inst);

    // Run post construct, if it wasn't passed in, otherwise it was already created
    if (hasPostConstruct(inst) && !params.includes(inst)) {
      await inst.postConstruct();
    }

    const metadata = SchemaRegistryIndex.get(candidate.candidateType).getMetadata<InjectableClassMetadata>(MetadataSymbol);

    // Run post constructors
    for (const op of Object.values(metadata?.postConstruct ?? {})) {
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
}