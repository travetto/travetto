import { ChangeEvent, ClassOrId, RegistrationMethods, RegistryIndex, RegistryV2 } from '@travetto/registry';
import { AppError, castKey, castTo, Class, classConstruct, getParentClass, Util } from '@travetto/runtime';

import { FieldConfig, ClassConfig, MethodConfig } from './types.ts';
import { SchemaRegistryAdapter } from './registry-adapter.ts';
import { SchemaChangeListener } from './changes.ts';

const classToSubTypeName = (cls: Class): string => cls.name
  .replace(/([A-Z])([A-Z][a-z])/g, (all, l, r) => `${l}_${r.toLowerCase()}`)
  .replace(/([a-z]|\b)([A-Z])/g, (all, l, r) => l ? `${l}_${r.toLowerCase()}` : r.toLowerCase())
  .toLowerCase();

/**
 * Schema registry index for managing schema configurations across classes
 */
export class SchemaRegistryIndex implements RegistryIndex<ClassConfig, MethodConfig, FieldConfig> {

  static getForRegister(clsOrId: ClassOrId): SchemaRegistryAdapter {
    return RegistryV2.getForRegister(this, clsOrId);
  }

  static get(clsOrId: ClassOrId): Omit<SchemaRegistryAdapter, RegistrationMethods> {
    return RegistryV2.get(this, clsOrId);
  }

  static getClassConfig(clsOrId: ClassOrId): ClassConfig {
    return RegistryV2.get(this, clsOrId).getClass();
  }

  static getClasses(): Class[] {
    return RegistryV2.getAll(this);
  }

  static has(clsOrId: ClassOrId): boolean {
    return RegistryV2.has(this, clsOrId);
  }

  static getSubTypesForClass(cls: Class): Class[] | undefined {
    return RegistryV2.instance(this).getSubTypesForClass(cls);
  }

  static resolveInstanceType<T>(cls: Class<T>, o: T): Class {
    return RegistryV2.instance(this).resolveInstanceType(cls, o);
  }

  static visitFields<T>(cls: Class<T>, onField: (field: FieldConfig, path: FieldConfig[]) => void): void {
    return RegistryV2.instance(this).visitFields(cls, onField);
  }

  #baseSchema = new Map<Class, Class>();
  #subTypes = new Map<Class, Map<string, Class>>();

  #removeClassData(cls: Class): void {
    this.#baseSchema.delete(cls);
  }

  #finalize(cls: Class): ClassConfig {
    const parent = getParentClass(cls);
    const parentConfig = parent ? this.getClassConfig(parent) : undefined;
    this.adapter(cls).finalize(parentConfig);
    return this.getClassConfig(cls);
  }

  #recomputeSubTypes(): void {
    this.#subTypes.clear();
    const all = RegistryV2.getAll(SchemaRegistryIndex);
    for (const el of all) {
      this.registerSubTypes(el);
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
    this.#removeClassData(event.prev);
  }

  #onRemoving(event: ChangeEvent<Class> & { type: 'removing' }): void {
    SchemaChangeListener.clearSchemaDependency(event.prev);
    this.#removeClassData(event.prev);
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
    for (const event of events) {
      if (event.type === 'added' || event.type === 'changed') {
        this.#finalize(event.curr);
      }
    }
    this.#recomputeSubTypes();
  }

  adapter(cls: Class): SchemaRegistryAdapter {
    return new SchemaRegistryAdapter(cls);
  }

  getClassConfig(cls: ClassOrId): ClassConfig {
    return SchemaRegistryIndex.get(cls).getClass();
  }

  /**
   * Find base schema class for a given class
   */
  getBaseSchema(cls: Class): Class {
    if (!this.#baseSchema.has(cls)) {
      let conf = this.getClassConfig(cls);
      let parent = cls;

      while (conf && !conf.baseType) {
        parent = getParentClass(parent)!;
        conf = this.getClassConfig(parent);
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
    cls = this.getClassConfig(cls.Ⲑid).class; // Resolve by id to handle any stale references

    const base = this.getBaseSchema(cls);
    const clsSchema = this.getClassConfig(cls);
    const baseSchema = this.getClassConfig(base);

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
    const config = (this.getClassConfig(cls) ?? this.getClassConfig(cls));
    let base: Class | undefined = this.getBaseSchema(cls);

    if (!this.#subTypes.has(base)) {
      this.#subTypes.set(base, new Map());
    }

    if (base !== cls || config.baseType) {
      config.subTypeField = (this.getClassConfig(base) ?? this.getClassConfig(base)).subTypeField;
      config.subTypeName = name ?? config.subTypeName ?? classToSubTypeName(cls);
      this.#subTypes.get(base)!.set(config.subTypeName!, cls);
    }
    if (base !== cls) {
      while (base && base.Ⲑid) {
        this.#subTypes.get(base)!.set(config.subTypeName!, cls);
        const parent = getParentClass(base);
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
  visitFields<T>(cls: Class<T>, onField: (field: FieldConfig, path: FieldConfig[]) => void, _path: FieldConfig[] = [], root = cls): void {
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
}