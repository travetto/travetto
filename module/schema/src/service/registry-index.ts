import { RegistrationMethods, RegistryIndex, RegistryIndexStore, Registry, ChangeEvent } from '@travetto/registry';
import { AppError, castKey, castTo, Class, classConstruct, getParentClass } from '@travetto/runtime';

import { SchemaFieldConfig, SchemaClassConfig, SchemaMethodConfig } from './types.ts';
import { SchemaDiscriminatedInfo, SchemaRegistryAdapter } from './registry-adapter.ts';

export interface SchemaClassChange {
  cls: Class;
  type: ChangeEvent<unknown>['type'];
  fieldChanges: ChangeEvent<SchemaFieldConfig>[];
  methodChanges: ChangeEvent<SchemaMethodConfig>[];
}

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

  static getDiscriminatedConfig<T>(cls: Class<T>): SchemaDiscriminatedInfo | undefined {
    return this.#instance.store.get(cls).getDiscriminatedConfig();
  }

  static has(cls: Class): boolean {
    return this.#instance.store.has(cls);
  }

  static getDiscriminatedTypes(cls: Class): string[] | undefined {
    return this.#instance.getDiscriminatedTypes(cls);
  }

  static resolveInstanceType<T>(cls: Class<T>, item: T): Class {
    return this.#instance.resolveInstanceType(cls, item);
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

  static computeClassChange(current: SchemaClassConfig, previous?: SchemaClassConfig): SchemaClassChange {
    return this.#instance.computeClassChange(current, previous);
  }

  static onClassChange(handler: (events: ChangeEvent<Class>[]) => void): void {
    Registry.onClassChange(SchemaRegistryIndex, { beforeChangeSetComplete: handler });
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

  constructor(source: unknown) { Registry.validateConstructor(source); }

  onCreate(cls: Class, previous?: Class | undefined): void {
    if (!previous) { return; }
    // TODO: Handle inherited changes properly, we need to rebuild subclasses when fields are changed
    // We also need to emit events for those changes, when possible
  }

  beforeChangeSetComplete(): void {
    // Rebuild indices after every "process" batch
    this.#byDiscriminatedTypes.clear();
    for (const cls of this.store.getClasses()) {
      this.#registerDiscriminatedTypes(cls);
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
      let config = this.getClassConfig(cls);
      let parent: Class | undefined = cls;
      while (parent && config.discriminatedType && !config.discriminatedBase) {
        parent = getParentClass(parent);
        if (parent) {
          config = this.store.getOptional(parent)?.get() ?? config;
        }
      }
      this.#baseSchema.set(cls, config.class);
    }
    return this.#baseSchema.get(cls)!;
  }

  /**
   * Find the resolved type for a given instance
   * @param cls Class for instance
   * @param item Actual instance
   */
  resolveInstanceType<T>(cls: Class<T>, item: T): Class {
    const { discriminatedField, discriminatedType, class: targetClass } = this.store.get(cls).get();
    if (!discriminatedField) {
      return targetClass;
    } else {
      const base = this.getBaseClass(targetClass);
      const map = this.#byDiscriminatedTypes.get(base);
      const type = castTo<string>(item[castKey<T>(discriminatedField)]) ?? discriminatedType;
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

  /**
   * Compute change between two versions of a class
   */
  computeClassChange(current: SchemaClassConfig, previous?: SchemaClassConfig): SchemaClassChange {
    const previousFields = new Set(Object.keys(previous?.fields ?? {}));
    const previousMethods = new Set(Object.keys(previous?.methods ?? {}));

    const currentFields = new Set(Object.keys(current?.fields ?? {}));
    const currentMethods = new Set(Object.keys(current?.methods ?? {}));

    const fieldChanges: ChangeEvent<SchemaFieldConfig>[] = [];
    const methodChanges: ChangeEvent<SchemaMethodConfig>[] = [];

    if (current) {
      for (const field of [...currentFields].filter(item => !previousFields.has(item))) {
        fieldChanges.push({ current: current.fields[field], type: 'create' });
      }
      for (const method of [...currentMethods].filter(item => !previousMethods.has(item))) {
        methodChanges.push({ current: current.methods[method], type: 'create' });
      }
    }

    if (previous) {
      for (const field of [...previousFields].filter(item => !currentFields.has(item))) {
        fieldChanges.push({ previous: previous.fields[field], type: 'delete' });
      }
      for (const method of [...previousMethods].filter(item => !currentMethods.has(item))) {
        methodChanges.push({ previous: previous.methods[method], type: 'delete' });
      }
    }

    if (previous && current) {
      // Handle class references changing, but keeping same id
      const compareTypes = (a: Class, b: Class): boolean => a.Ⲑid ? a.Ⲑid === b.Ⲑid : a === b;

      for (const field of currentFields) {
        if (previousFields.has(field)) {
          const prevSchema = previous.fields[field];
          const currSchema = current.fields[field];
          if (
            JSON.stringify(prevSchema) !== JSON.stringify(currSchema) ||
            !compareTypes(prevSchema.type, currSchema.type)
          ) {
            fieldChanges.push({ previous: previous.fields[field], current: current.fields[field], type: 'update' });
          }
        }
      }

      for (const method of currentMethods) {
        if (current.methods[method]?.hash !== previous.methods[method]?.hash) {
          methodChanges.push({ previous: previous.methods[method], current: current.methods[method], type: 'update' });
        }
      }
    }
    return { cls: current.class, type: 'update', fieldChanges, methodChanges };
  }
}