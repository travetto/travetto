import { Class, AppError } from '@travetto/base';
import { MetadataRegistry, RootRegistry, ChangeEvent } from '@travetto/registry';

import { ClassList, FieldConfig, ClassConfig, SchemaConfig, ViewFieldsConfig } from './types';
import { SchemaChangeListener } from './changes';
import { BindUtil } from '../bind-util';
import { AllViewⲐ } from '../internal/types';

function hasType<T>(o: unknown): o is { type: Class<T> | string } {
  return !!o && 'type' in (o as object) && !!(o as Record<string, string>)['type'];
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

  /**
   * Find the subtype for a given instance
   * @param cls Class for instance
   * @param o Actual instance
   */
  resolveSubTypeForInstance<T>(cls: Class<T>, o: T) {
    return this.resolveSubType(cls, hasType<T>(o) ? o.type : (o as unknown as { constructor: Class<T> }).constructor);
  }

  /**
   * Resolve the sub type for a class and a type
   * @param cls The base class
   * @param type The sub tye value
   */
  resolveSubType(cls: Class, type: Class | string): Class {
    if (this.#subTypes.has(cls)) {
      const typeId = type && (typeof type === 'string' ? type : type.ᚕid);
      if (type) {
        return this.#subTypes.get(cls)!.get(typeId) ?? cls;
      }
    } else {
      const expectedType = this.#typeKeys.get(cls);
      if (expectedType && typeof type === 'string' && expectedType !== type) {
        throw new AppError(`Data of type ${type} does not match expected class type ${expectedType}`, 'data');
      }
    }
    return cls;
  }

  /**
   * Get subtype name for a class
   * @param cls Base class
   */
  getSubTypeName(cls: Class) {
    return cls.name
      .replace(/([A-Z])([A-Z][a-z])/g, (all, l, r) => `${l}_${r.toLowerCase()}`)
      .replace(/([a-z]|\b)([A-Z])/g, (all, l, r) => l ? `${l}_${r.toLowerCase()}` : r.toLowerCase())
      .toLowerCase();
  }

  /**
   * Register sub types for a class
   * @param cls The class to register against
   * @param type The subtype name
   */
  registerSubTypes(cls: Class, type: string) {
    let parent = this.getParentClass(cls)!;
    let parentConfig = this.get(parent);

    while (parentConfig) {
      if (!this.#subTypes.has(parent)) {
        this.#subTypes.set(parent, new Map());
      }
      this.#typeKeys.set(cls, type);
      this.#subTypes.get(parent)!.set(type, cls);
      this.#subTypes.get(parent)!.set(cls.ᚕid, cls);
      parent = this.getParentClass(parent!)!;
      parentConfig = this.get(parent);
    }
  }

  /**
   * Track changes to schemas, and track the dependent changes
   * @param cls The root class of the hierarchy
   * @param curr The new class
   * @param path The path within the object hierarchy
   */
  trackSchemaDependencies(cls: Class, curr: Class = cls, path: FieldConfig[] = []) {
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

  createPending(cls: Class) {
    return {
      class: cls,
      validators: [],
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
   * @param view Thee view name
   */
  getViewSchema<T>(cls: Class<T>, view?: string | typeof AllViewⲐ) {
    view = view ?? AllViewⲐ;

    const schm = this.get(cls)!;
    if (!schm) {
      throw new Error(`Unknown schema class ${cls.name}`);
    }
    const res = schm.views[view];
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
  coereceMethodParams<T>(cls: Class<T>, method: string, params: unknown[], applyDefaults = false): unknown[] {
    return BindUtil.coereceFields(this.getMethodSchema(cls, method), params, applyDefaults);
  }

  /**
   * Register a view
   * @param target The target class
   * @param view View name
   * @param fields Fields to register
   */
  registerPendingView<T>(target: Class<T>, view: string, fields: ViewFieldsConfig<T>) {
    if (!this.#pendingViews.has(target)) {
      this.#pendingViews.set(target, new Map());
    }
    this.#pendingViews.get(target)!.set(view, fields as ViewFieldsConfig<unknown>);
  }

  /**
   * Register a partial config for a pending method param
   * @param target The class to target
   * @param prop The method name
   * @param idx The param index
   * @param config The config to register
   */
  registerPendingParamFacet(target: Class, prop: string, idx: number, config: Partial<FieldConfig>) {
    config.index = idx;
    return this.registerPendingFieldFacet(target, `${prop}.${idx}`, config);
  }

  /**
   * Register a partial config for a pending field
   * @param target The class to target
   * @param prop The property name
   * @param config The config to register
   */
  registerPendingFieldFacet(target: Class, prop: string, config: Partial<FieldConfig>) {
    const allViewConf = this.getOrCreatePending(target).views![AllViewⲐ];

    if (!allViewConf.schema[prop]) {
      allViewConf.fields.push(prop);
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
  registerPendingParamConfig(target: Class, method: string, idx: number, type: ClassList, conf?: Partial<FieldConfig>) {
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
  registerPendingFieldConfig(target: Class, prop: string, type: ClassList, conf?: Partial<FieldConfig>) {
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
  mergeConfigs(dest: ClassConfig, src: ClassConfig) {
    dest.views[AllViewⲐ] = {
      schema: { ...dest.views[AllViewⲐ].schema, ...src.views[AllViewⲐ].schema },
      fields: [...dest.views[AllViewⲐ].fields, ...src.views[AllViewⲐ].fields]
    };
    dest.title = src.title || dest.title;
    dest.validators = [...src.validators, ...dest.validators];
    return dest;
  }

  /**
   * Project all pending views into a final state
   * @param target The target class
   * @param conf The class config
   */
  finalizeViews<T>(target: Class<T>, conf: ClassConfig) {
    const allViewConf = conf.views![AllViewⲐ];
    const pending = this.#pendingViews.get(target) ?? new Map<string, ViewFieldsConfig<unknown>>();
    this.#pendingViews.delete(target);

    for (const [view, fields] of pending.entries()) {
      const withoutSet = 'without' in fields ? new Set(fields.without as string[]) : undefined;
      const fieldList = withoutSet ?
        allViewConf.fields.filter(x => !withoutSet.has(x)) :
        ('with' in fields ? fields.with as string[] : []);

      conf.views![view] = {
        fields: fieldList as string[],
        schema: fieldList.reduce((acc, v) => {
          acc[v] = allViewConf.schema[v];
          return acc;
        }, {} as SchemaConfig)
      };
    }

    return conf;
  }

  onInstallFinalize(cls: Class) {

    let config: ClassConfig = this.createPending(cls) as ClassConfig;

    // Merge parent
    const parent = this.getParentClass(cls);
    if (parent) {
      const parentConfig = this.get(parent);
      if (parentConfig) {
        config = this.mergeConfigs(config, parentConfig);
      }
    }

    this.registerSubTypes(cls, this.getSubTypeName(cls));

    // Merge pending, back on top, to allow child to have higher precedence
    const pending = this.getOrCreatePending(cls);
    if (pending) {
      config = this.mergeConfigs(config, pending as ClassConfig);
    }

    // Write views out
    config = this.finalizeViews(cls, config);

    return config;
  }

  override onInstall(cls: Class, e: ChangeEvent<Class>) {
    super.onInstall(cls, e);

    if (this.has(cls)) { // Track dependencies of schemas
      this.trackSchemaDependencies(cls);
    }
  }

  override onUninstall<T>(cls: Class<T>, e: ChangeEvent<Class>) {
    super.onUninstall(cls, e);
    if (e.type === 'removing' && this.hasExpired(cls)) {
      // Recompute subtypes
      this.#subTypes.clear();
      this.#methodSchemas.delete(cls);
      for (const el of this.entries.keys()) {
        const clz = this.entries.get(el)!.class;
        this.registerSubTypes(clz, this.getSubTypeName(clz));
      }

      SchemaChangeListener.clearSchemaDependency(cls);
    }
  }

  override emit(ev: ChangeEvent<Class>) {
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