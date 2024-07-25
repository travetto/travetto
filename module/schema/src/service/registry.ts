import { Class, AppError, describeFunction } from '@travetto/runtime';
import { MetadataRegistry, RootRegistry, ChangeEvent } from '@travetto/registry';

import { ClassList, FieldConfig, ClassConfig, SchemaConfig, ViewFieldsConfig, ViewConfig } from './types';
import { SchemaChangeListener } from './changes';
import { AllViewⲐ } from '../internal/types';

const classToSubTypeName = (cls: Class): string => cls.name
  .replace(/([A-Z])([A-Z][a-z])/g, (all, l, r) => `${l}_${r.toLowerCase()}`)
  .replace(/([a-z]|\b)([A-Z])/g, (all, l, r) => l ? `${l}_${r.toLowerCase()}` : r.toLowerCase())
  .toLowerCase();

/**
 * Schema registry for listening to changes
 */
class $SchemaRegistry extends MetadataRegistry<ClassConfig, FieldConfig> {

  #accessorDescriptors = new Map<Class, Map<string, PropertyDescriptor>>();
  #subTypes = new Map<Class, Map<string, Class>>();
  #pendingViews = new Map<Class, Map<string, ViewFieldsConfig<unknown>>>();
  #baseSchema = new Map<Class, Class>();

  constructor() {
    super(RootRegistry);
  }

  /**
   * Find base schema class for a given class
   */
  getBaseSchema(cls: Class): Class {
    if (!this.#baseSchema.has(cls)) {
      let conf = this.get(cls) ?? this.getOrCreatePending(cls);
      let parent = cls;

      while (conf && !conf.baseType) {
        parent = this.getParentClass(parent)!;
        conf = this.get(parent) ?? this.pending.get(MetadataRegistry.id(parent));
      }

      this.#baseSchema.set(cls, conf ? parent : cls);
    }
    return this.#baseSchema.get(cls)!;
  }

  /**
   * Retrieve class level metadata
   * @param cls
   * @param prop
   * @param key
   * @returns
   */
  getMetadata<K>(cls: Class, key: symbol): K | undefined {
    const cfg = this.get(cls);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return cfg.metadata?.[key] as K;
  }

  /**
   * Retrieve pending class level metadata, or create if needed
   * @param cls
   * @param prop
   * @param key
   * @returns
   */
  getOrCreatePendingMetadata<K>(cls: Class, key: symbol, value: K): K {
    const cfg = this.getOrCreatePending(cls);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return ((cfg.metadata ??= {})[key] ??= value) as K;
  }

  /**
   * Ensure type is set properly
   */
  ensureInstanceTypeField<T>(cls: Class, o: T): void {
    const schema = this.get(cls);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const typeField = (schema.subTypeField) as keyof T;
    if (schema.subTypeName && typeField in schema.views[AllViewⲐ].schema && !o[typeField]) {  // Do we have a type field defined
      // @ts-expect-error
      o[typeField] = schema.subTypeName; // Assign if missing
    }
  }

  /**
   * Provides the prototype-derived descriptor for a property
   */
  getAccessorDescriptor(cls: Class, field: string): PropertyDescriptor {
    if (!this.#accessorDescriptors.has(cls)) {
      this.#accessorDescriptors.set(cls, new Map());
    }
    const map = this.#accessorDescriptors.get(cls)!;
    if (!map.has(field)) {
      let proto = cls.prototype;
      while (proto && !Object.hasOwn(proto, field)) {
        proto = proto.prototype;
      }
      map.set(field, Object.getOwnPropertyDescriptor(proto, field)!);
    }
    return map.get(field)!;
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
      // @ts-expect-error
      const type = o[baseSchema.subTypeField] ?? clsSchema.subTypeName ?? baseSchema.subTypeName;
      const ret = this.#subTypes.get(base)!.get(type)!;
      // @ts-expect-error
      if (ret && !(new ret() instanceof cls)) {
        throw new AppError(`Resolved class ${ret.name} is not assignable to ${cls.name}`);
      }
      return ret;
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
    const config = (this.get(cls) ?? this.getOrCreatePending(cls));
    let base: Class | undefined = this.getBaseSchema(cls);

    if (!this.#subTypes.has(base)) {
      this.#subTypes.set(base, new Map());
    }

    if (base !== cls || config.baseType) {
      config.subTypeField = (this.get(base) ?? this.getOrCreatePending(base)).subTypeField;
      config.subTypeName = name ?? config.subTypeName ?? classToSubTypeName(cls);
      this.#subTypes.get(base)!.set(config.subTypeName!, cls);
    }
    if (base !== cls) {
      while (base && ('Ⲑid' in base)) {
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
    const view = config.views[AllViewⲐ];
    for (const k of view.fields) {
      if (this.has(view.schema[k].type) && view.schema[k].type !== cls) {
        this.trackSchemaDependencies(cls, view.schema[k].type, [...path, view.schema[k]]);
      }
    }
  }

  createPending(cls: Class): ClassConfig {
    return {
      class: cls,
      validators: [],
      subTypeField: 'type',
      baseType: describeFunction(cls)?.abstract,
      metadata: {},
      methods: {},
      views: {
        [AllViewⲐ]: {
          schema: {},
          fields: []
        }
      }
    };
  }

  /**
   * Get schema for a given view
   * @param cls The class to retrieve the schema for
   * @param view The view name
   */
  getViewSchema<T>(cls: Class<T>, view?: string | typeof AllViewⲐ): ViewConfig {
    view = view ?? AllViewⲐ;

    const schema = this.get(cls)!;
    if (!schema) {
      throw new Error(`Unknown schema class ${cls.name}`);
    }
    const res = schema.views[view];
    if (!res) {
      throw new Error(`Unknown view ${view.toString()} for ${cls.name}`);
    }
    return res;
  }

  /**
   * Get schema for a method invocation
   * @param cls
   * @param method
   */
  getMethodSchema<T>(cls: Class<T>, method: string): FieldConfig[] {
    return (this.get(cls)?.methods?.[method] ?? []).filter(x => !!x).sort((a, b) => a.index! - b.index!);
  }

  /**
   * Register a view
   * @param target The target class
   * @param view View name
   * @param fields Fields to register
   */
  registerPendingView<T>(target: Class<T>, view: string, fields: ViewFieldsConfig<T>): void {
    if (!this.#pendingViews.has(target)) {
      this.#pendingViews.set(target, new Map());
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const generalConfig = fields as unknown as ViewFieldsConfig<unknown>;
    this.#pendingViews.get(target)!.set(view, generalConfig);
  }

  /**
   * Register a partial config for a pending method param
   * @param target The class to target
   * @param prop The method name
   * @param idx The param index
   * @param config The config to register
   */
  registerPendingParamFacet(target: Class, method: string, idx: number, config: Partial<FieldConfig>): Class {
    const methods = this.getOrCreatePending(target)!.methods!;
    const params = (methods[method] ??= []);
    if (config.name === '') {
      delete config.name;
    }

    if (config.aliases) {
      config.aliases = [...params[idx]?.aliases ?? [], ...config.aliases];
    }
    if (config.specifiers) {
      config.specifiers = [...params[idx]?.specifiers ?? [], ...config.specifiers];
    }

    params[idx] = {
      // @ts-expect-error
      name: `${method}.${idx}`,
      ...params[idx] ?? {},
      owner: target,
      index: idx,
      ...config,
    };
    return target;
  }

  /**
   * Register a partial config for a pending field
   * @param target The class to target
   * @param prop The property name
   * @param config The config to register
   */
  registerPendingFieldFacet(target: Class, prop: string, config: Partial<FieldConfig>): Class {
    const allViewConf = this.getOrCreatePending(target).views![AllViewⲐ];

    if (!allViewConf.schema[prop]) {
      allViewConf.fields.push(prop);
      // Partial config while building
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      allViewConf.schema[prop] = {} as FieldConfig;
    }
    if (config.aliases) {
      config.aliases = [...allViewConf.schema[prop].aliases ?? [], ...config.aliases];
    }
    if (config.specifiers) {
      config.specifiers = [...allViewConf.schema[prop].specifiers ?? [], ...config.specifiers];
    }

    Object.assign(allViewConf.schema[prop], config);

    return target;
  }

  /**
   * Register pending field configuration
   * @param target Target class
   * @param method Method name
   * @param idx Param index
   * @param type List of types
   * @param conf Extra config
   */
  registerPendingParamConfig(target: Class, method: string, idx: number, type: ClassList, conf?: Partial<FieldConfig>): Class {
    return this.registerPendingParamFacet(target, method, idx, {
      ...conf,
      array: Array.isArray(type),
      type: Array.isArray(type) ? type[0] : type,
    });
  }

  /**
   * Register pending field configuration
   * @param target Target class
   * @param prop Property name
   * @param type List of types
   * @param conf Extra config
   */
  registerPendingFieldConfig(target: Class, prop: string, type: ClassList, conf?: Partial<FieldConfig>): Class {
    const fieldConf: FieldConfig = {
      owner: target,
      name: prop,
      array: Array.isArray(type),
      type: Array.isArray(type) ? type[0] : type,
      ...(conf ?? {})
    };

    return this.registerPendingFieldFacet(target, prop, fieldConf);
  }

  /**
   * Merge two class configs
   * @param dest Target config
   * @param src Source config
   */
  mergeConfigs(dest: ClassConfig, src: Partial<ClassConfig>, inherited = false): ClassConfig {
    dest.views[AllViewⲐ] = {
      schema: { ...dest.views[AllViewⲐ].schema, ...src.views?.[AllViewⲐ].schema },
      fields: [...dest.views[AllViewⲐ].fields, ...src.views?.[AllViewⲐ].fields ?? []]
    };
    if (!inherited) {
      dest.baseType = src.baseType ?? dest.baseType;
      dest.subTypeName = src.subTypeName ?? dest.subTypeName;
    }
    dest.methods = { ...src.methods ?? {}, ...dest.methods ?? {} };
    dest.metadata = { ...src.metadata ?? {}, ...dest.metadata ?? {} };
    dest.subTypeField = src.subTypeField ?? dest.subTypeField;
    dest.title = src.title || dest.title;
    dest.validators = [...src.validators ?? [], ...dest.validators];
    return dest;
  }

  /**
   * Project all pending views into a final state
   * @param target The target class
   * @param conf The class config
   */
  finalizeViews<T>(target: Class<T>, conf: ClassConfig): ClassConfig {
    const allViewConf = conf.views![AllViewⲐ];
    const pending = this.#pendingViews.get(target) ?? new Map<string, ViewFieldsConfig<string>>();
    this.#pendingViews.delete(target);

    for (const [view, fields] of pending.entries()) {
      const withoutSet = 'without' in fields ? new Set<string>(fields.without) : undefined;
      const fieldList = withoutSet ?
        allViewConf.fields.filter(x => !withoutSet.has(x)) :
        ('with' in fields ? fields.with : []);

      conf.views![view] = {
        fields: fieldList,
        schema: fieldList.reduce<SchemaConfig>((acc, v) => {
          acc[v] = allViewConf.schema[v];
          return acc;
        }, {})
      };
    }

    return conf;
  }

  onInstallFinalize(cls: Class): ClassConfig {

    let config: ClassConfig = this.createPending(cls);

    // Merge parent
    const parent = this.getParentClass(cls);
    if (parent) {
      const parentConfig = this.get(parent);
      if (parentConfig) {
        config = this.mergeConfigs(config, parentConfig, true);
      }
    }

    this.registerSubTypes(cls);

    // Merge pending, back on top, to allow child to have higher precedence
    const pending = this.getOrCreatePending(cls);
    if (pending) {
      config = this.mergeConfigs(config, pending);
    }

    // Write views out
    config = this.finalizeViews(cls, config);

    if (config.subTypeName && config.subTypeField in config.views[AllViewⲐ].schema) {
      const field = config.views[AllViewⲐ].schema[config.subTypeField];
      config.views[AllViewⲐ].schema[config.subTypeField] = {
        ...field,
        enum: {
          values: [config.subTypeName],
          message: `${config.subTypeField} can only be '${config.subTypeName}'`,
        }
      };
    }

    return config;
  }

  override onInstall(cls: Class, e: ChangeEvent<Class>): void {
    super.onInstall(cls, e);

    if (this.has(cls)) { // Track dependencies of schemas
      this.trackSchemaDependencies(cls);
    }
  }

  override onUninstall<T>(cls: Class<T>, e: ChangeEvent<Class>): void {
    super.onUninstall(cls, e);
    if (e.type === 'removing' && this.hasExpired(cls)) {
      // Recompute subtypes
      this.#subTypes.clear();
      this.#baseSchema.delete(cls);
      this.#accessorDescriptors.delete(cls);

      // Recompute subtype mappings
      for (const el of this.entries.keys()) {
        const clz = this.entries.get(el)!.class;
        this.registerSubTypes(clz);
      }

      SchemaChangeListener.clearSchemaDependency(cls);
    }
  }

  override emit(ev: ChangeEvent<Class>): void {
    super.emit(ev);
    if (ev.type === 'changed') {
      SchemaChangeListener.emitFieldChanges({
        type: 'changed',
        curr: this.get(ev.curr!),
        prev: this.getExpired(ev.curr!)
      });
    }
  }
}

export const SchemaRegistry = new $SchemaRegistry();