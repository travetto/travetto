import { ChangeEvent, ClassOrId, RegistryIndex, RegistryV2 } from '@travetto/registry';
import { AppError, castKey, castTo, Class, classConstruct, getParentClass, Util } from '@travetto/runtime';

import { SchemaFieldConfig, SchemaClassConfig, SchemaFieldMap, SchemaMethodConfig } from './types.ts';
import { SchemaRegistryAdapter } from './registry-adapter.ts';
import { SchemaChangeListener } from './changes.ts';

const classToSubTypeName = (cls: Class): string => cls.name
  .replace(/([A-Z])([A-Z][a-z])/g, (all, l, r) => `${l}_${r.toLowerCase()}`)
  .replace(/([a-z]|\b)([A-Z])/g, (all, l, r) => l ? `${l}_${r.toLowerCase()}` : r.toLowerCase())
  .toLowerCase();

/**
 * Schema registry index for managing schema configurations across classes
 */
export class SchemaRegistryIndex implements RegistryIndex<SchemaClassConfig> {

  static { RegistryV2.registerIndex(SchemaRegistryIndex); }

  static adapterCls = SchemaRegistryAdapter;

  static getForRegister(clsOrId: ClassOrId, allowFinalized = false): SchemaRegistryAdapter {
    return RegistryV2.getForRegister(this, clsOrId, allowFinalized);
  }

  static getConfig(clsOrId: ClassOrId): SchemaClassConfig {
    return RegistryV2.get(this, clsOrId).get();
  }

  static getFieldMap(clsOrId: ClassOrId, view?: string): SchemaFieldMap {
    return RegistryV2.get(this, clsOrId).getSchema(view);
  }

  static getMethodConfig(clsOrId: ClassOrId, method: string | symbol): SchemaMethodConfig {
    return RegistryV2.get(this, clsOrId).getMethod(method);
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

  static visitFields<T>(cls: Class<T>, onField: (field: SchemaFieldConfig, path: SchemaFieldConfig[]) => void): void {
    return RegistryV2.instance(this).visitFields(cls, onField);
  }

  static getClassesByBaseType(cls: Class): Class[] {
    return RegistryV2.instance(this).getClassesByBaseType(cls);
  }

  static getBaseClass(cls: Class): Class {
    return RegistryV2.instance(this).getBaseClass(cls);
  }

  #baseSchema = new Map<Class, Class>();
  #baseSchemasGrouped = new Map<Class, Class[]>();
  #subTypes = new Map<Class, Map<string, Class>>();

  /**
   * Register sub types for a class
   */
  #registerSubTypes(cls: Class, name?: string): void {
    // Mark as subtype
    const config = this.getClassConfig(cls);
    let base: Class | undefined = this.getBaseClass(cls);

    if (!this.#subTypes.has(base)) {
      this.#subTypes.set(base, new Map());
    }

    if (!this.#baseSchemasGrouped.has(base)) {
      this.#baseSchemasGrouped.set(base, []);
    }

    const baseList = this.#baseSchemasGrouped.get(base)!;

    if (base !== cls || config.baseType) {
      baseList.push(cls);
      config.subTypeField = (this.getClassConfig(base) ?? this.getClassConfig(base)).subTypeField;
      config.subTypeName = name ?? config.subTypeName ?? classToSubTypeName(cls);
      this.#subTypes.get(base)!.set(config.subTypeName!, cls);
    }
    if (base !== cls) {
      while (base && base.Ⲑid) {
        if (!this.#subTypes.has(base)) {
          this.#subTypes.set(base, new Map());
        }
        this.#subTypes.get(base)!.set(config.subTypeName!, cls);
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
    this.#subTypes.clear();
    this.#baseSchemasGrouped.clear();
    for (const el of RegistryV2.getClasses(SchemaRegistryIndex)) {
      this.#registerSubTypes(el);
    }
  }

  getClassConfig(cls: ClassOrId): SchemaClassConfig {
    return RegistryV2.get(SchemaRegistryIndex, cls).get();
  }

  /**
   * Find base schema class for a given class
   */
  getBaseClass(cls: Class): Class {
    if (!this.#baseSchema.has(cls)) {
      let conf: SchemaClassConfig | undefined = this.getClassConfig(cls);
      let parent: Class | undefined = cls;

      while (parent && conf && !conf.baseType) {
        parent = getParentClass(parent);
        if (parent) {
          conf = this.getClassConfig(parent);
        }
      }

      this.#baseSchema.set(cls, conf ? conf.class : cls);
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

    const base = this.getBaseClass(cls);
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