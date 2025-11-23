import { ChangeEvent, ClassOrId, RegistryIndexStore, RegistryV2, RetargettingProxy } from '@travetto/registry';
import { AppError, castKey, castTo, Class, describeFunction, getParentClass, hasFunction, Runtime, TypedObject, Util } from '@travetto/runtime';
import { SchemaFieldConfig, SchemaParameterConfig, SchemaRegistryIndex } from '@travetto/schema';

import {
  ClassTarget, Dependency, InjectableCandidate, InjectableClassMetadata,
  InjectableConfig, ResolutionType, PrimaryCandidateSymbol
} from '../types';
import { DependencyRegistryAdapter } from './registry-adapter';
import { InjectionError } from '../error';
import { DependencyRegistryResolver } from './registry-resolver';

const MetadataSymbol = Symbol();

type ClassId = string;
const hasPostConstruct = hasFunction<{ postConstruct: () => Promise<unknown> }>('postConstruct');
const hasPreDestroy = hasFunction<{ preDestroy: () => Promise<unknown> }>('preDestroy');


function readMetadata(item: { metadata?: Record<symbol, unknown> }): Dependency | undefined {
  return item.metadata?.[MetadataSymbol] as Dependency | undefined;
}

export class DependencyRegistryIndex {

  static #instance = RegistryV2.registerIndex(DependencyRegistryIndex);

  static getForRegister(clsOrId: ClassOrId): DependencyRegistryAdapter {
    return this.#instance.store.getForRegister(clsOrId);
  }

  static getInstance<T>(candidateType: Class<T>, qualifier?: symbol, resolution?: ResolutionType): Promise<T> {
    return this.#instance.getInstance(candidateType, qualifier, resolution);
  }

  static getCandidates<T>(candidateType: Class<T>): InjectableCandidate<T>[] {
    return this.#instance.getCandidates<T>(candidateType);
  }

  static getInstances<T>(candidateType: Class<T>, predicate?: (cfg: InjectableCandidate<T>) => boolean): Promise<T[]> {
    return this.#instance.getInstances<T>(candidateType, predicate);
  }

  static injectFields<T extends { constructor: Class<T> }>(o: T, cls = o.constructor): Promise<T> {
    return this.#instance.injectFields(cls, o, cls);
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

  #instances = new Map<ClassId, Map<symbol, unknown>>();
  #instancePromises = new Map<ClassId, Map<symbol, Promise<unknown>>>();
  #proxies = new Map<ClassId, Map<symbol | undefined, RetargettingProxy<unknown>>>();
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

    for (const config of adapter.getCandidateConfigs()) {
      // Skip out early, only needed to inherit
      if (describeFunction(config.candidateType)?.abstract) {
        continue;
      }

      const parentClass = getParentClass(config.candidateType);
      const parentConfig = parentClass ? this.store.getOptional(parentClass) : undefined;
      const hasParentBase = (parentConfig || (parentClass && !!describeFunction(parentClass)?.abstract));
      const baseParentId = hasParentBase ? parentClass?.Ⲑid : undefined;
      this.#resolver.registerClass(config, baseParentId);
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
      for (const [qualifier, config] of this.#resolver.getContainerEntries(cls)) {
        this.destroyInstance(config.candidateType, qualifier);
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
  getCandidates<T>(candidateType: Class<T>): InjectableCandidate<T>[] {
    return this.#resolver.getCandidateEntries(candidateType).map(([_, x]) => castTo<InjectableCandidate<T>>(x));
  }

  /**
   * Get candidate instances by target type, with an optional filter
   */
  getInstances<T>(candidateType: Class<T>, predicate?: (cfg: InjectableCandidate<T>) => boolean): Promise<T[]> {
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

  async #resolveDependencyValue(dependency: Dependency, input: SchemaFieldConfig | SchemaParameterConfig, src: Class): Promise<unknown> {
    try {
      const target = dependency.target ?? input.type;
      return await this.getInstance(target, dependency.qualifier, dependency.resolution);
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
  async fetchDependencyParameters<T>(candidate: InjectableCandidate<T>): Promise<unknown[]> {
    const inputs = SchemaRegistryIndex.getMethodConfig(candidate.class, candidate.method).parameters;

    const promises = inputs
      .map(input => this.#resolveDependencyValue(readMetadata(input) ?? {}, input, candidate.class));

    return await Promise.all(promises);
  }

  /**
   * Retrieve mapped dependencies
   */
  async injectFields<T>(candidateType: Class, instance: T, srcClass: Class): Promise<T> {
    const inputs = SchemaRegistryIndex.getFieldMap(candidateType);

    const promises = TypedObject.entries(inputs)
      .filter(([k, input]) => instance[castKey(k)] === undefined && readMetadata(input) !== undefined)
      .map(async ([k, input]) => [k, await this.#resolveDependencyValue(readMetadata(input) ?? {}, input, srcClass)] as const);

    const pairs = await Promise.all(promises);

    for (const [k, v] of pairs) {
      instance[castKey(k)] = castTo(v);
    }
    return instance;
  }

  /**
   * Actually construct an instance while resolving the dependencies
   */
  async construct<T>(candidateType: Class<T>, qualifier: symbol): Promise<T> {
    const { candidate } = this.#resolver.resolveCandidate(candidateType, qualifier);
    const params = await this.fetchDependencyParameters(candidate);
    const inst = await candidate.factory(params);

    // And auto-wire fields
    await this.injectFields(candidate.candidateType, inst, candidate.class);

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
    return Runtime.dynamic ? this.#proxyInstance(candidateType, qualifier, inst) : inst;
  }

  /**
   * Get or create the instance
   */
  async getInstance<T>(candidateType: Class<T>, requestedQualifier?: symbol, resolution?: ResolutionType): Promise<T> {
    if (!candidateType) {
      throw new AppError('Unable to get instance when target is undefined');
    }

    const { targetId, qualifier } = this.#resolver.resolveCandidate(candidateType, requestedQualifier, resolution);

    if (!this.#instances.has(targetId)) {
      this.#instances.set(targetId, new Map());
      this.#instancePromises.set(targetId, new Map());
    }

    if (this.#instancePromises.get(targetId)!.has(qualifier)) {
      return castTo(this.#instancePromises.get(targetId)!.get(qualifier));
    }

    const instancePromise = this.construct(candidateType, qualifier);
    this.#instancePromises.get(targetId)!.set(qualifier, instancePromise);
    try {
      const instance = await instancePromise;
      this.#instances.get(targetId)!.set(qualifier, instance);
      return instance;
    } catch (err) {
      // Clear it out, don't save failed constructions
      this.#instancePromises.get(targetId)!.delete(qualifier);
      throw err;
    }
  }

  /**
   * Destroy an instance
   */
  destroyInstance(candidateType: Class, requestedQualifier: symbol): void {
    const { targetId, qualifier } = this.#resolver.resolveCandidate(candidateType, requestedQualifier);

    const activeInstance = this.#instances.get(targetId)!.get(qualifier);
    if (hasPreDestroy(activeInstance)) {
      activeInstance.preDestroy();
    }

    this.#resolver.removeClass(candidateType, qualifier);
    this.#instances.get(targetId)!.delete(qualifier);
    this.#instancePromises.get(targetId)!.delete(qualifier);

    // May not exist
    this.#proxies.get(targetId)?.get(qualifier)?.setTarget(null);
    console.debug('On uninstall', { id: targetId, qualifier: qualifier.toString(), classId: targetId });
  }
}