import { ChangeEvent, RegistrationMethods, RegistryIndexStore, RegistryV2 } from '@travetto/registry';
import { AppError, castKey, castTo, Class, classConstruct, ClassInstance, getParentClass, Util } from '@travetto/runtime';

import { SchemaFieldConfig, SchemaClassConfig, SchemaFieldMap, SchemaMethodConfig } from './types.ts';
import { SchemaRegistryAdapter } from './registry-adapter.ts';
import { SchemaChangeListener } from './changes.ts';

/**
 * Schema registry index for managing schema configurations across classes
 */
export class SchemaRegistryIndex {

  static #instance = RegistryV2.registerIndex(SchemaRegistryIndex);

  static getForRegister(instanceOrClass: Class | ClassInstance, allowFinalized = false): SchemaRegistryAdapter {
    return this.#instance.store.getForRegister(instanceOrClass, allowFinalized);
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

  static getClassesByBaseType(cls: Class): Class[] {
    return this.#instance.getClassesByBaseType(cls);
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
  #baseSchemasGrouped = new Map<Class, Class[]>();
  #byDiscriminatedTypes = new Map<Class, Map<string, Class>>();

  /**
   * Register sub types for a class
   */
  #registerSubTypes(cls: Class): void {
    // Mark as subtype
    const config = this.getClassConfig(cls);
    let base: Class | undefined = this.getBaseClass(cls);

    if (!this.#byDiscriminatedTypes.has(base)) {
      this.#byDiscriminatedTypes.set(base, new Map());
    }

    if (!this.#baseSchemasGrouped.has(base)) {
      this.#baseSchemasGrouped.set(base, []);
    }

    if (config.classType === 'discriminated-base') {
      const baseList = this.#baseSchemasGrouped.get(base)!;
      baseList.push(cls);
      this.#byDiscriminatedTypes.get(base)!.set(config.discriminatedType!, cls);
    }
    if (base !== cls) {
      while (base && base.Ⲑid) {
        if (!this.#byDiscriminatedTypes.has(base)) {
          this.#byDiscriminatedTypes.set(base, new Map());
        }
        this.#byDiscriminatedTypes.get(base)!.set(config.discriminatedType!, cls);
        const parent = getParentClass(base);
        base = parent ? this.getBaseClass(parent) : undefined;
      }
    }
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
    this.#baseSchemasGrouped.clear();
    for (const el of this.store.getClasses()) {
      this.#registerSubTypes(el);
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
  resolveInstanceType<T>(cls: Class<T>, o: T): Class {
    const adapter = this.store.get(cls); // Resolve by id to handle any stale references
    const base = this.getBaseClass(cls);
    const discriminatedConfig = adapter.getDiscriminatedConfig();

    if (discriminatedConfig) { // We have a sub type
      const type = castTo<string>(o[castKey<T>(discriminatedConfig.discriminatedField)]) ?? discriminatedConfig.discriminatedType;
      const discriminatedCls = this.#byDiscriminatedTypes.get(base)!.get(type)!;
      if (discriminatedCls && !(classConstruct(discriminatedCls) instanceof cls)) {
        throw new AppError(`Resolved class ${discriminatedCls.name} is not assignable to ${cls.name}`);
      }
      return discriminatedCls;
    } else {
      return cls;
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
  getClassesByBaseType(cls: Class): Class[] {
    return this.#baseSchemasGrouped.get(cls) ?? [];
  }
}