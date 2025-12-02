import { ChangeEvent, RegistrationMethods, RegistryIndex, RegistryIndexStore, Registry } from '@travetto/registry';
import { AppError, castKey, castTo, Class, classConstruct, getParentClass, Util } from '@travetto/runtime';

import { SchemaFieldConfig, SchemaClassConfig } from './types.ts';
import { SchemaRegistryAdapter } from './registry-adapter.ts';
import { SchemaChangeListener } from './changes.ts';

/**
 * Schema registry index for managing schema configurations across classes
 */
export class SchemaRegistryIndex implements RegistryIndex {

  static #instance = Registry.registerIndex(SchemaRegistryIndex);

  static getForRegister(cls: Class, allowFinalized = false): SchemaRegistryAdapter {
    return this.#instance.store.getForRegister(cls, allowFinalized);
  }

  static getConfig(cls: Class): SchemaClassConfig {
    return this.#instance.store.get(cls).get();
  }

  static getDiscriminatedConfig<T>(cls: Class<T>): Required<Pick<SchemaClassConfig, 'discriminatedType' | 'discriminatedField' | 'discriminatedBase'>> | undefined {
    return this.#instance.store.get(cls).getDiscriminatedConfig();
  }

  static has(cls: Class): boolean {
    return this.#instance.store.has(cls);
  }

  static getClassById(classId: string): Class {
    return this.#instance.store.getClassById(classId);
  }

  static getDiscriminatedTypes(cls: Class): string[] | undefined {
    return this.#instance.getDiscriminatedTypes(cls);
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

  static getOptional(cls: Class): Omit<SchemaRegistryAdapter, RegistrationMethods> | undefined {
    return this.#instance.store.getOptional(cls);
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
    if (!config.discriminatedType) {
      return;
    }
    const base = this.getBaseClass(cls);
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
      while (parent && conf.discriminatedType && !conf.discriminatedBase) {
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
    const { discriminatedField, discriminatedType, class: targetClass } = this.store.get(cls).get();
    if (!discriminatedField) {
      return targetClass;
    } else {
      const base = this.getBaseClass(targetClass);
      const map = this.#byDiscriminatedTypes.get(base);
      const type = castTo<string>(o[castKey<T>(discriminatedField)]) ?? discriminatedType;
      if (!type) {
        throw new AppError(`Unable to resolve discriminated type for class ${base.name} without a type`);
      }
      if (!map?.has(type)) {
        throw new AppError(`Unable to resolve discriminated type '${type}' for class ${base.name}`);
      }
      const requested = map.get(type)!;
      if (!(classConstruct(requested) instanceof targetClass)) {
        throw new AppError(`Resolved discriminated type '${type}' for class ${base.name} is not an instance of requested type ${targetClass.name}`);
      }
      return requested;
    }
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
   * Return all subtypes by discriminator for a given class
   * @param cls The base class to resolve from
   */
  getDiscriminatedClasses(cls: Class): Class[] {
    return [...this.#byDiscriminatedTypes.get(cls)?.values() ?? []];
  }

  /**
   * Get all discriminated types for a given class
   */
  getDiscriminatedTypes(cls: Class): string[] | undefined {
    const map = this.#byDiscriminatedTypes.get(cls);
    if (map) {
      return [...map.keys()];
    }
    return undefined;
  }
}