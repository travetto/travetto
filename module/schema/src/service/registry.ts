import { Class, AppError, Util, ClassInstance, ConcreteClass } from '@travetto/base';
import { MetadataRegistry, RootRegistry, ChangeEvent } from '@travetto/registry';

import { ClassList, FieldConfig, ClassConfig, SchemaConfig, ViewFieldsConfig, ViewConfig } from './types';
import { SchemaChangeListener } from './changes';
import { BindUtil } from '../bind-util';
import { AllViewⲐ } from '../internal/types';

function hasType<T>(o: unknown): o is { type: Class<T> | string } {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return !!o && !Util.isPrimitive(o) && 'type' in (o as object) && !!(o as Record<string, string>)['type'];
}

function isWithType<T>(o: T, cfg: ClassConfig | undefined): o is T & { type?: string } {
  return !!cfg && !!cfg.subType && 'type' in cfg.views[AllViewⲐ].schema;
}

function getConstructor<T>(o: T): ConcreteClass<T> {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return (o as unknown as ClassInstance<T>).constructor;
}


/**
 * Schema registry for listening to changes
 */
class $SchemaRegistry extends MetadataRegistry<ClassConfig, FieldConfig> {

  #subTypes = new Map<Class, Map<string, Class>>();
  #typeKeys = new Map<Class, string>();
  #pendingViews = new Map<Class, Map<string, ViewFieldsConfig<unknown>>>();
  #methodSchemas = new Map<Class, Map<string, FieldConfig[]>>();

  constructor() {
    super(RootRegistry);
  }

  #computeSubTypeName(cls: Class): string {
    if (!this.#typeKeys.has(cls)) {
      this.#typeKeys.set(cls, cls.name
        .replace(/([A-Z])([A-Z][a-z])/g, (all, l, r) => `${l}_${r.toLowerCase()}`)
        .replace(/([a-z]|\b)([A-Z])/g, (all, l, r) => l ? `${l}_${r.toLowerCase()}` : r.toLowerCase())
        .toLowerCase());
    }
    return this.#typeKeys.get(cls)!;
  }

  /**
   * Get subtype name for a class
   * @param cls Base class
   */
  getSubTypeName(cls: Class): string | undefined {
    if (this.get(cls).subType) {
      return this.#computeSubTypeName(cls);
    }
  }

  /**
   * Ensure type is set properly
   */
  ensureInstanceTypeField<T>(cls: Class, o: T): void {
    if (isWithType(o, this.get(cls)) && !o.type) {  // Do we have a type field defined
      o.type = this.#computeSubTypeName(cls); // Assign if missing
    }
  }

  /**
   * Find the subtype for a given instance
   * @param cls Class for instance
   * @param o Actual instance
   */
  resolveSubTypeForInstance<T>(cls: Class<T>, o: T): Class {
    return this.resolveSubType(cls, hasType<T>(o) ? o.type : getConstructor(o));
  }

  /**
   * Resolve the sub type for a class and a type
   * @param cls The base class
   * @param type The sub tye value
   */
  resolveSubType(cls: Class, type: Class | string): Class {
    if (this.#subTypes.has(cls)) {
      const typeId = type && (typeof type === 'string' ? type : type.Ⲑid);
      if (type) {
        return this.#subTypes.get(cls)!.get(typeId) ?? cls;
      }
    } else if (this.get(cls)?.subType) {
      const expectedType = this.#typeKeys.get(cls);
      if (expectedType && typeof type === 'string' && expectedType !== type) {
        throw new AppError(`Data of type ${type} does not match expected class type ${expectedType}`, 'data');
      }
    }
    return cls;
  }

  /**
   * Register sub types for a class
   * @param cls The class to register against
   * @param type The subtype name
   */
  registerSubTypes(cls: Class, type?: string): string {
    // Mark as subtype
    (this.get(cls) ?? this.getOrCreatePending(cls)).subType = true;

    type ??= this.#computeSubTypeName(cls)!;

    this.#typeKeys.set(cls, type);

    let parent = this.getParentClass(cls)!;
    let parentConfig = this.get(parent);

    while (parentConfig) {
      if (!this.#subTypes.has(parent)) {
        this.#subTypes.set(parent, new Map());
      }
      this.#subTypes.get(parent)!.set(type, cls);
      this.#subTypes.get(parent)!.set(cls.Ⲑid, cls);
      parent = this.getParentClass(parent!)!;
      parentConfig = this.get(parent);
    }

    return type;
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
      subType: false,
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
    if (!this.#methodSchemas.has(cls)) {
      this.#methodSchemas.set(cls, new Map());
    }
    const cache = this.#methodSchemas.get(cls)!;
    if (!cache.has(method) && this.has(cls)) {
      const { fields, schema } = this.getViewSchema(cls);
      const out = [];
      for (const el of fields) {
        if (el.startsWith(`${method}.`)) {
          out.push(schema[el]);
        }
      }
      out.sort((a, b) => a.index! - b.index!);
      cache.set(method, out);
    }
    return cache.get(method)! ?? [];
  }

  /**
   * Coerce method parameters when possible
   * @param cls
   * @param method
   * @param params
   * @returns
   */
  coerceMethodParams<T>(cls: Class<T>, method: string, params: unknown[], applyDefaults = false): unknown[] {
    return BindUtil.coerceFields(this.getMethodSchema(cls, method), params, applyDefaults);
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
  registerPendingParamFacet(target: Class, prop: string, idx: number, config: Partial<FieldConfig>): Class {
    config.index = idx;
    return this.registerPendingFieldFacet(target, `${prop}.${idx}`, config);
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
    conf ??= {};
    conf.index = idx;
    return this.registerPendingFieldConfig(target, `${method}.${idx}`, type, conf);
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
  mergeConfigs(dest: ClassConfig, src: Partial<ClassConfig>): ClassConfig {
    dest.views[AllViewⲐ] = {
      schema: { ...dest.views[AllViewⲐ].schema, ...src.views?.[AllViewⲐ].schema },
      fields: [...dest.views[AllViewⲐ].fields, ...src.views?.[AllViewⲐ].fields ?? []]
    };
    dest.subType = src.subType || dest.subType;
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
        config = this.mergeConfigs(config, parentConfig);
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
      this.#typeKeys.delete(cls);
      this.#methodSchemas.delete(cls);

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