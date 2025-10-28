import { ChangeEvent, ClassOrId, RegistryIndex, RegistryV2 } from '@travetto/registry';
import { AppError, castKey, castTo, Class, classConstruct } from '@travetto/runtime';

import { FieldConfig, ClassConfig, MethodConfig } from './types.ts';
import { SchemaAdapter } from './registry-adapter.ts';
import { SchemaChangeListener } from './changes.ts';

const classToSubTypeName = (cls: Class): string => cls.name
  .replace(/([A-Z])([A-Z][a-z])/g, (all, l, r) => `${l}_${r.toLowerCase()}`)
  .replace(/([a-z]|\b)([A-Z])/g, (all, l, r) => l ? `${l}_${r.toLowerCase()}` : r.toLowerCase())
  .toLowerCase();

/**
 * Schema registry index for managing schema configurations across classes
 */
export class SchemaRegistryIndex implements RegistryIndex<ClassConfig, MethodConfig, FieldConfig> {

  static getForRegister(clsOrId: ClassOrId): SchemaAdapter {
    return RegistryV2.getForRegister(this, clsOrId);
  }

  static get(clsOrId: ClassOrId): Omit<SchemaAdapter, `register${string}` | 'finalize' | 'unregister'> {
    return RegistryV2.get(this, clsOrId);
  }

  static getAll(): Class[] {
    return RegistryV2.getAll(this);
  }

  static instance(): SchemaRegistryIndex {
    return RegistryV2.instance(this);
  }

  static has(clsOrId: ClassOrId): boolean {
    return RegistryV2.has(this, clsOrId);
  }

  #baseSchema = new Map<Class, Class>();
  #subTypes = new Map<Class, Map<string, Class>>();

  #removeClassData(cls: Class): void {
    this.#baseSchema.delete(cls);
  }

  #finalize(cls: Class): ClassConfig {
    const parent = this.getParentClass(cls);
    const parentConfig = parent ? this.get(parent) : undefined;
    this.adapter(cls).finalize(parentConfig);
    return this.get(cls);
  }

  #recomputeSubTypes(): void {
    this.#subTypes.clear();
    const all = RegistryV2.getAll(SchemaRegistryIndex);
    for (const el of all) {
      this.registerSubTypes(el);
    }
  }

  #onChanged(event: ChangeEvent<Class> & { type: 'changed' }): void {
    SchemaChangeListener.emitFieldChanges({
      type: 'changed',
      curr: this.get(event.curr),
      prev: this.get(event.prev)
    });
    this.#removeClassData(event.prev);
  }

  #onRemoving(event: ChangeEvent<Class> & { type: 'removing' }): void {
    SchemaChangeListener.clearSchemaDependency(event.prev);
    this.#removeClassData(event.prev);
  }

  #onAdded(event: ChangeEvent<Class> & { type: 'added' }): void {
    SchemaChangeListener.emitFieldChanges({
      type: 'added',
      curr: this.get(event.curr)
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
    for (const event of events) {
      if (event.type === 'added' || event.type === 'changed') {
        this.#finalize(event.curr);
      }
    }
    this.#recomputeSubTypes();
  }

  adapter(cls: Class): SchemaAdapter {
    return new SchemaAdapter(cls);
  }

  get(cls: ClassOrId, finalizedOnly = true): ClassConfig {
    return (finalizedOnly ?
      SchemaRegistryIndex.get(cls) :
      SchemaRegistryIndex.getForRegister(cls)
    ).get();
  }

  has(cls: ClassOrId): boolean {
    return SchemaRegistryIndex.has(cls);
  }

  /**
   * Find parent class for a given class object
   */
  getParentClass(cls: Class): Class | null {
    const parent: Class = Object.getPrototypeOf(cls);
    return parent.name && parent !== Object ? parent : null;
  }

  /**
   * Find base schema class for a given class
   */
  getBaseSchema(cls: Class): Class {
    if (!this.#baseSchema.has(cls)) {
      let conf = this.get(cls);
      let parent = cls;

      while (conf && !conf.baseType) {
        parent = this.getParentClass(parent)!;
        conf = this.get(parent);
      }

      this.#baseSchema.set(cls, conf ? parent : cls);
    }
    return this.#baseSchema.get(cls)!;
  }

  /**
   * Find the resolved type for a given instance
   * @param cls Class for instance
   * @param o Actual instance
   */
  resolveInstanceType<T>(cls: Class<T>, o: T): Class {
    cls = this.get(cls.Ⲑid).class; // Resolve by id to handle any stale references

    const base = this.getBaseSchema(cls);
    const clsSchema = this.get(cls);
    const baseSchema = this.get(base);

    if (clsSchema.subTypeName || baseSchema.baseType) { // We have a sub type
      const type = castTo<string>(o[castKey<T>(baseSchema.subTypeField)]) ?? clsSchema.subTypeName ?? baseSchema.subTypeName;
      const subType = this.#subTypes.get(base)!.get(type)!;
      if (subType && !(classConstruct(subType) instanceof cls)) {
        throw new AppError(`Resolved class ${subType.name} is not assignable to ${cls.name}`);
      }
      return subType;
    } else {
      return cls;
    }
  }

  /**
   * Return all subtypes by discriminator for a given class
   * @param cls The base class to resolve from
   */
  getSubTypesForClass(cls: Class): Class[] | undefined {
    const res = this.#subTypes.get(cls)?.values();
    return res ? [...res] : undefined;
  }

  /**
   * Register sub types for a class
   * @param cls The class to register against
   * @param name The subtype name
   */
  registerSubTypes(cls: Class, name?: string): void {
    // Mark as subtype
    const config = (this.get(cls) ?? this.get(cls));
    let base: Class | undefined = this.getBaseSchema(cls);

    if (!this.#subTypes.has(base)) {
      this.#subTypes.set(base, new Map());
    }

    if (base !== cls || config.baseType) {
      config.subTypeField = (this.get(base) ?? this.get(base)).subTypeField;
      config.subTypeName = name ?? config.subTypeName ?? classToSubTypeName(cls);
      this.#subTypes.get(base)!.set(config.subTypeName!, cls);
    }
    if (base !== cls) {
      while (base && base.Ⲑid) {
        this.#subTypes.get(base)!.set(config.subTypeName!, cls);
        const parent = this.getParentClass(base);
        base = parent ? this.getBaseSchema(parent) : undefined;
      }
    }
  }

  /**
   * Track changes to schemas, and track the dependent changes
   * @param cls The root class of the hierarchy
   * @param curr The new class
   * @param path The path within the object hierarchy
   */
  trackSchemaDependencies(cls: Class, curr: Class = cls, path: FieldConfig[] = []): void {
    const config = this.get(curr);

    SchemaChangeListener.trackSchemaDependency(curr, cls, path, this.get(cls));

    // Read children
    for (const field of Object.values(config.fields)) {
      if (this.has(field.type) && field.type !== cls) {
        this.trackSchemaDependencies(cls, field.type, [...path, field]);
      }
    }
  }

  /**
   * Visit fields recursively
   */
  visitFields<T>(cls: Class<T>, onField: (field: FieldConfig, path: FieldConfig[]) => void, _path: FieldConfig[] = [], root = cls): void {
    const fields = this.has(cls) ?
      Object.values(this.get(cls).fields) :
      [];
    for (const field of fields) {
      if (this.has(field.type)) {
        this.visitFields(field.type, onField, [..._path, field], root);
      } else {
        onField(field, _path);
      }
    }
  }
}