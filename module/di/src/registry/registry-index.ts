import { type RegistryIndex, RegistryIndexStore, Registry } from '@travetto/registry';
import { RuntimeError, castKey, castTo, type Class, describeFunction, getParentClass, hasFunction, TypedObject } from '@travetto/runtime';
import { type SchemaFieldConfig, type SchemaParameterConfig, SchemaRegistryIndex } from '@travetto/schema';

import type { Dependency, InjectableCandidate, InjectableClassMetadata, InjectableConfig, ResolutionType } from '../types.ts';
import { DependencyRegistryAdapter } from './registry-adapter.ts';
import { InjectionError } from '../error.ts';
import { DependencyRegistryResolver } from './registry-resolver.ts';

const MetadataSymbol = Symbol();

const hasPostConstruct = hasFunction<{ postConstruct: () => Promise<unknown> }>('postConstruct');
const hasPreDestroy = hasFunction<{ preDestroy: () => Promise<unknown> }>('preDestroy');

function readMetadata(item: { metadata?: Record<symbol, unknown> }): Dependency | undefined {
  return castTo<Dependency | undefined>(item.metadata?.[MetadataSymbol]);
}

export class DependencyRegistryIndex implements RegistryIndex {

  static #instance = Registry.registerIndex(DependencyRegistryIndex);

  static getForRegister(cls: Class): DependencyRegistryAdapter {
    return this.#instance.store.getForRegister(cls);
  }

  static getInstance<T>(candidateType: Class<T>, qualifier?: symbol, resolution?: ResolutionType): Promise<T> {
    return this.#instance.getInstance(candidateType, qualifier, resolution);
  }

  static getCandidates<T>(candidateType: Class<T>): InjectableCandidate<T>[] {
    return this.#instance.getCandidates<T>(candidateType);
  }

  static getInstances<T>(candidateType: Class<T>, predicate?: (config: InjectableCandidate<T>) => boolean): Promise<T[]> {
    return this.#instance.getInstances<T>(candidateType, predicate);
  }

  static injectFields<T extends { constructor: Class<T> }>(item: T, cls = item.constructor): Promise<T> {
    return this.#instance.injectFields(cls, item, cls);
  }

  static registerClassMetadata(cls: Class, metadata: InjectableClassMetadata): void {
    SchemaRegistryIndex.getForRegister(cls).registerMetadata<InjectableClassMetadata>(MetadataSymbol, metadata);
  }

  static registerParameterMetadata(cls: Class, method: string, index: number, metadata: Dependency): void {
    SchemaRegistryIndex.getForRegister(cls).registerParameterMetadata(method, index, MetadataSymbol, metadata);
  }

  static registerFieldMetadata(cls: Class, field: string, metadata: Dependency): void {
    SchemaRegistryIndex.getForRegister(cls).registerFieldMetadata(field, MetadataSymbol, metadata);
  }

  #instances = new Map<Class, Map<symbol, unknown>>();
  #instancePromises = new Map<Class, Map<symbol, Promise<unknown>>>();
  #resolver = new DependencyRegistryResolver();

  async #resolveDependencyValue(dependency: Dependency, input: SchemaFieldConfig | SchemaParameterConfig, cls: Class): Promise<unknown> {
    try {
      const target = dependency.target ?? input.type;
      return await this.getInstance(target, dependency.qualifier, dependency.resolution);
    } catch (error) {
      if (input.required?.active === false && error instanceof InjectionError && error.category === 'notfound') {
        return undefined;
      } else {
        if (error && error instanceof Error) {
          error.message = `${error.message} via=${cls.Ⲑid}[${input.name?.toString() ?? 'constructor'}]`;
        }
        throw error;
      }
    }
  }

  store = new RegistryIndexStore(DependencyRegistryAdapter);

  /** @private */ constructor(source: unknown) { Registry.validateConstructor(source); }

  getConfig(cls: Class): InjectableConfig {
    return this.store.get(cls).get();
  }

  onCreate(cls: Class): void {
    const adapter = this.store.get(cls);

    for (const config of adapter.getCandidateConfigs()) {
      const parentClass = getParentClass(config.candidateType);
      const parentConfig = parentClass ? this.store.getOptional(parentClass) : undefined;
      const hasParentBase = (parentConfig || (parentClass && !!describeFunction(parentClass)?.abstract));
      const baseParent = hasParentBase ? parentClass : undefined;
      this.#resolver.registerClass(config, baseParent);
    }
  }

  // Setup instances after change set complete
  onChangeSetComplete(classes: Class[]): void {
    for (const cls of classes) {
      const adapter = this.store.get(cls);
      for (const config of adapter.getCandidateConfigs()) {
        if (config.autoInject) {
          this.getInstance(config.candidateType, config.qualifier);
        }
      }
    }
  }

  /**
   * Get all available candidates for a given type
   */
  getCandidates<T>(candidateType: Class<T>): InjectableCandidate<T>[] {
    return this.#resolver.getCandidateEntries(candidateType).map(([_, candidate]) => castTo<InjectableCandidate<T>>(candidate));
  }

  /**
   * Get candidate instances by target type, with an optional filter
   */
  getInstances<T>(candidateType: Class<T>, predicate?: (config: InjectableCandidate<T>) => boolean): Promise<T[]> {
    const inputs = this.getCandidates<T>(candidateType).filter(candidate => !predicate || predicate(candidate));
    return Promise.all(inputs.map(candidate => this.getInstance<T>(candidate.class, candidate.qualifier)));
  }

  /**
   * Retrieve list dependencies
   */
  async fetchDependencyParameters<T>(candidate: InjectableCandidate<T>): Promise<unknown[]> {
    const inputs = SchemaRegistryIndex.has(candidate.class) ?
      SchemaRegistryIndex.get(candidate.class).getMethod(candidate.method).parameters : [];

    const promises = inputs
      .map(input => this.#resolveDependencyValue(readMetadata(input) ?? {}, input, candidate.class));

    return await Promise.all(promises);
  }

  /**
   * Retrieve mapped dependencies
   */
  async injectFields<T>(candidateType: Class, instance: T, srcClass: Class): Promise<T> {
    const inputs = SchemaRegistryIndex.getOptional(candidateType)?.getFields() ?? {};

    const promises = TypedObject.entries(inputs)
      .filter(([key, input]) => readMetadata(input) !== undefined && (input.access !== 'readonly' && instance[castKey(key)] === undefined))
      .map(async ([key, input]) => [key, await this.#resolveDependencyValue(readMetadata(input) ?? {}, input, srcClass)] as const);

    const pairs = await Promise.all(promises);

    for (const [key, value] of pairs) {
      instance[castKey(key)] = castTo(value);
    }
    return instance;
  }

  /**
   * Actually construct an instance while resolving the dependencies
   */
  async construct<T>(candidateType: Class<T>, qualifier: symbol): Promise<T> {
    const { candidate } = this.#resolver.resolveCandidate(candidateType, qualifier);
    const targetType = candidate.candidateType;
    const params = await this.fetchDependencyParameters(candidate);
    const inst = await candidate.factory(...params);

    // And auto-wire fields
    await this.injectFields(targetType, inst, candidate.class);

    // Run post construct, if it wasn't passed in, otherwise it was already created
    if (hasPostConstruct(inst) && !params.includes(inst)) {
      await inst.postConstruct();
    }

    const metadata = SchemaRegistryIndex.has(targetType) ?
      SchemaRegistryIndex.get(targetType).getMetadata<InjectableClassMetadata>(MetadataSymbol) : undefined;

    // Run post constructors
    for (const operation of Object.values(metadata?.postConstruct ?? {})) {
      await operation(inst);
    }

    // Proxy if necessary
    return inst;
  }

  /**
   * Get or create the instance
   */
  async getInstance<T>(candidateType: Class<T>, requestedQualifier?: symbol, resolution?: ResolutionType): Promise<T> {
    if (!candidateType) {
      throw new RuntimeError('Unable to get instance when target is undefined');
    }

    const { target, qualifier } = this.#resolver.resolveCandidate(candidateType, requestedQualifier, resolution);

    const instances = this.#instances.getOrInsert(target, new Map());
    const instancePromises = this.#instancePromises.getOrInsert(target, new Map());

    if (instancePromises.has(qualifier)) {
      return castTo(instancePromises.get(qualifier));
    }

    const instancePromise = this.construct(candidateType, qualifier);
    instancePromises.set(qualifier, instancePromise);
    try {
      const instance = await instancePromise;
      instances.set(qualifier, instance);
      return instance;
    } catch (error) {
      // Clear it out, don't save failed constructions
      instancePromises.delete(qualifier);
      throw error;
    }
  }

  /**
   * Destroy an instance
   */
  destroyInstance(candidateType: Class, requestedQualifier: symbol): void {
    const { target, qualifier } = this.#resolver.resolveCandidate(candidateType, requestedQualifier);

    const activeInstance = this.#instances.get(target)?.get(qualifier);
    if (hasPreDestroy(activeInstance)) {
      activeInstance.preDestroy();
    }

    this.#resolver.removeClass(candidateType, qualifier);
    this.#instances.get(target)?.delete(qualifier);
    this.#instancePromises.get(target)?.delete(qualifier);

    // May not exist
    console.debug('On uninstall', { id: target, qualifier: qualifier.toString(), classId: target });
  }
}