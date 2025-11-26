import { ChangeEvent, RegistrationMethods, RegistryIndex, RegistryIndexStore, RegistryV2 } from '@travetto/registry';
import { AppError, castKey, castTo, Class, classConstruct, getParentClass, Util } from '@travetto/runtime';

import { SchemaFieldConfig, SchemaClassConfig, SchemaFieldMap, SchemaMethodConfig } from './types.ts';
import { SchemaRegistryAdapter } from './registry-adapter.ts';
import { SchemaChangeListener } from './changes.ts';

/**
 * Schema registry index for managing schema configurations across classes
 */
export class SchemaRegistryIndex implements RegistryIndex {

  static #instance = RegistryV2.registerIndex(SchemaRegistryIndex);

  static getForRegister(cls: Class, allowFinalized = false): SchemaRegistryAdapter {
    return this.#instance.store.getForRegister(cls, allowFinalized);
  }

  static getConfig(cls: Class): SchemaClassConfig {
    return this.#instance.store.get(cls).get();
  }

  static getDiscriminatedConfig<T>(cls: Class<T>): Required<Pick<SchemaClassConfig, 'discriminatedType' | 'discriminatedField'>> | undefined {
    return this.#instance.store.get(cls).getDiscriminatedConfig();
  }

  static getFieldMap(cls: Class, view?: string): SchemaFieldMap {
    return this.#instance.store.get(cls).getSchema(view);
  }

  static getMethodConfig(cls: Class, method: string | symbol): SchemaMethodConfig {
    return this.#instance.store.get(cls).getMethod(method);
  }

  static has(cls: Class): boolean {
    return this.#instance.store.has(cls);
  }

  static getDiscriminatedTypesForClass(cls: Class): Class[] | undefined {
    return this.#instance.getDiscriminatedTypesForClass(cls);
  }

  static resolveInstanceType<T>(cls: Class<T>, o: T): Class {
    return this.#instance.resolveInstanceType(cls, o);
  }

  static visitFields<T>(cls: Class<T>, onField: (field: SchemaFieldConfig, path: SchemaFieldConfig[]) => void): void {
    return this.#instance.visitFields(cls, onField);
  }

  static getDiscriminatedClasses(cls: Class): Class[] {
    return this.#instance.getDiscriminatedClasses(cls);
  }

  static getBaseClass(cls: Class): Class {
    return this.#instance.getBaseClass(cls);
  }

  static get(cls: Class): Omit<SchemaRegistryAdapter, RegistrationMethods> {
    return this.#instance.store.get(cls);
  }

  static getOptionalConfig(cls: Class): SchemaClassConfig | undefined {
    return this.#instance.store.getOptional(cls)?.get();
  }

  static getClasses(): Class[] {
    return this.#instance.store.getClasses();
  }

  store = new RegistryIndexStore(SchemaRegistryAdapter);
  #baseSchema = new Map<Class, Class>();
  #byDiscriminatedTypes = new Map<Class, Map<string, Class>>();

  /**
   * Register discriminated types for a class
   */
  #registerDiscriminatedTypes(cls: Class): void {
    // Mark as subtype
    const config = this.getClassConfig(cls);
    if (config.classType === 'standard' || !config.discriminatedType) {
      return;
    }

    let base = this.getBaseClass(cls);
    if (!this.#byDiscriminatedTypes.has(base)) {
      this.#byDiscriminatedTypes.set(base, new Map());
    }
    this.#byDiscriminatedTypes.get(base)!.set(config.discriminatedType, cls);
  }

  #onChanged(event: ChangeEvent<Class> & { type: 'changed' }): void {
    Util.queueMacroTask().then(() => {
      SchemaChangeListener.emitFieldChanges({
        type: 'changed',
        curr: this.getClassConfig(event.curr),
        prev: this.getClassConfig(event.prev)
      });
    });
  }

  #onRemoving(event: ChangeEvent<Class> & { type: 'removing' }): void {
    SchemaChangeListener.clearSchemaDependency(event.prev);
  }

  #onAdded(event: ChangeEvent<Class> & { type: 'added' }): void {
    Util.queueMacroTask().then(() => {
      SchemaChangeListener.emitFieldChanges({
        type: 'added',
        curr: this.getClassConfig(event.curr)
      });
    });
  }

  process(events: ChangeEvent<Class>[]): void {
    for (const event of events) {
      if (event.type === 'changed') {
        this.#onChanged(event);
      } else if (event.type === 'removing') {
        this.#onRemoving(event);
      } else if (event.type === 'added') {
        this.#onAdded(event);
      }
    }

    // Rebuild indices after every "process" batch
    this.#byDiscriminatedTypes.clear();
    for (const el of this.store.getClasses()) {
      this.#registerDiscriminatedTypes(el);
    }
  }

  finalize(cls: Class): void {
    this.store.finalize(cls);
  }

  getClassConfig(cls: Class): SchemaClassConfig {
    return this.store.get(cls).get();
  }

  /**
   * Find base schema class for a given class
   */
  getBaseClass(cls: Class): Class {
    if (!this.#baseSchema.has(cls)) {
      let conf = this.getClassConfig(cls);
      let parent: Class | undefined = cls;
      while (parent && conf.classType === 'discriminated') {
        parent = getParentClass(parent);
        if (parent) {
          conf = this.store.getOptional(parent)?.get() ?? conf;
        }
      }
      this.#baseSchema.set(cls, conf.class);
    }
    return this.#baseSchema.get(cls)!;
  }

  /**
   * Find the resolved type for a given instance
   * @param cls Class for instance
   * @param o Actual instance
   */
  resolveInstanceType<T>(requestedCls: Class<T>, o: T): Class {
    const cls = this.store.getClassById(requestedCls); // Resolve by id to handle any stale references
    const adapter = this.store.get(cls);
    const { classType, discriminatedField, discriminatedType } = adapter.get();
    if (classType !== 'discriminated' && classType !== 'discriminated-base') {
      return cls;
    } else {
      const base = this.getBaseClass(cls);
      const map = this.#byDiscriminatedTypes.get(base);
      if (!discriminatedField) {
        throw new AppError(`Unable to resolve discriminated type for class ${base.name} without a discriminated field`);
      }
      const type = castTo<string>(o[castKey<T>(discriminatedField)]) ?? discriminatedType;
      if (!type) {
        throw new AppError(`Unable to resolve discriminated type for class ${base.name} without a type`);
      }
      if (!map) {
        throw new AppError(`Unable to resolve discriminated type map for class ${base.name}`);
      }
      if (!map.has(type)) {
        throw new AppError(`Unable to resolve discriminated type '${type}' for class ${base.name}`);
      }
      const requested = map.get(type)!;
      if (!(classConstruct(requested) instanceof requestedCls)) {
        throw new AppError(`Resolved discriminated type '${type}' for class ${base.name} is not an instance of requested type ${requestedCls.name}`);
      }
      return requested;
    }
  }

  /**
   * Return all subtypes by discriminator for a given class
   * @param cls The base class to resolve from
   */
  getDiscriminatedTypesForClass(cls: Class): Class[] | undefined {
    const res = this.#byDiscriminatedTypes.get(cls)?.values();
    return res ? [...res] : undefined;
  }

  /**
   * Track changes to schemas, and track the dependent changes
   * @param cls The root class of the hierarchy
   * @param curr The new class
   * @param path The path within the object hierarchy
   */
  trackSchemaDependencies(cls: Class, curr: Class = cls, path: SchemaFieldConfig[] = []): void {
    const config = this.getClassConfig(curr);

    SchemaChangeListener.trackSchemaDependency(curr, cls, path, this.getClassConfig(cls));

    // Read children
    for (const field of Object.values(config.fields)) {
      if (SchemaRegistryIndex.has(field.type) && field.type !== cls) {
        this.trackSchemaDependencies(cls, field.type, [...path, field]);
      }
    }
  }

  /**
   * Visit fields recursively
   */
  visitFields<T>(cls: Class<T>, onField: (field: SchemaFieldConfig, path: SchemaFieldConfig[]) => void, _path: SchemaFieldConfig[] = [], root = cls): void {
    const fields = SchemaRegistryIndex.has(cls) ?
      Object.values(this.getClassConfig(cls).fields) :
      [];
    for (const field of fields) {
      if (SchemaRegistryIndex.has(field.type)) {
        this.visitFields(field.type, onField, [..._path, field], root);
      } else {
        onField(field, _path);
      }
    }
  }

  /**
   * Find all classes by their base types
   */
  getDiscriminatedClasses(cls: Class): Class[] {
    return [...this.#byDiscriminatedTypes.get(cls)?.values() ?? []];
  }
}