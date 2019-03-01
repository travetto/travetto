import { MetadataRegistry, RootRegistry, Class, ChangeEvent } from '@travetto/registry';
import { Env } from '@travetto/base';
import { ClassList, FieldConfig, ClassConfig, ALL_VIEW, SchemaConfig, ViewFieldsConfig } from './types';
import {
  SchemaChangeListener,
  SchemaChangeEvent, FieldChangeEvent,
  SCHEMA_CHANGE_EVENT, FIELD_CHANGE_EVENT
} from './changes';

export class $SchemaRegistry extends MetadataRegistry<ClassConfig, FieldConfig> {

  subTypes = new Map<Class, Map<string, Class>>();
  pendingViews = new Map<Class, Map<string, ViewFieldsConfig<any>>>();

  constructor() {
    super(RootRegistry);
  }

  resolveSubTypeForInstance<T>(cls: Class<T>, o: T) {
    return this.resolveSubType(cls, (o as any).type || o.constructor);
  }

  resolveSubType(cls: Class, type: Class | string) {
    const typeId = type && (typeof type === 'string' ? type : type.__id);
    const hasId = this.subTypes.has(cls) && type;
    return (hasId && this.subTypes.get(cls)!.get(typeId!)!) || cls;
  }

  getSubTypeName(cls: Class) {
    return cls.name
      .replace(/([A-Z])([A-Z][a-z])/g, (all, l, r) => `${l}_${r.toLowerCase()}`)
      .replace(/([a-z]|\b)([A-Z])/g, (all, l, r) => l ? `${l}_${r.toLowerCase()}` : r.toLowerCase())
      .toLowerCase();
  }

  registerSubTypes(cls: Class, type: string) {
    let parent = this.getParentClass(cls)!;
    let parentConfig = this.get(parent);

    while (parentConfig) {
      if (!this.subTypes.has(parent)) {
        this.subTypes.set(parent, new Map());
      }
      this.subTypes.get(parent)!.set(type, cls);
      this.subTypes.get(parent)!.set(cls.__id, cls);
      parent = this.getParentClass(parent!)!;
      parentConfig = this.get(parent);
    }
  }

  trackSchemaDependencies(cls: Class, curr: Class = cls, path: string[] = []) {
    const config = this.get(curr);

    SchemaChangeListener.trackSchemaDependency(curr, cls, path, this.get(cls));

    // Read children
    const view = config.views[ALL_VIEW];
    for (const k of view.fields) {
      if (this.has(view.schema[k].type)) {
        this.trackSchemaDependencies(cls, view.schema[k].type, [...path, k]);
      }
    }
  }

  createPending(cls: Class) {
    return {
      class: cls,
      validators: [],
      views: {
        [ALL_VIEW]: {
          schema: {},
          fields: []
        }
      }
    };
  }

  getViewSchema<T>(cls: Class<T>, view?: string) {
    view = view || ALL_VIEW;

    const schm = this.get(cls)!;
    if (!schm) {
      throw new Error(`Unknown schema class ${cls.name}`);
    }
    const res = schm.views[view];
    if (!res) {
      throw new Error(`Unknown view ${view} for ${cls.name}`);
    }
    return res;
  }

  registerPendingView<T>(target: Class<T>, view: string, fields: ViewFieldsConfig<T>) {
    if (!this.pendingViews.has(target)) {
      this.pendingViews.set(target, new Map());
    }
    this.pendingViews.get(target)!.set(view, fields);
  }

  registerPendingFieldFacet(target: Class, prop: string, config: any) {
    const allViewConf = this.getOrCreatePending(target).views![ALL_VIEW];

    if (!allViewConf.schema[prop]) {
      allViewConf.fields.push(prop);
      allViewConf.schema[prop] = {} as any;
    }

    Object.assign(allViewConf.schema[prop], config);

    return target;
  }

  registerPendingFieldConfig(target: Class, prop: string, type: ClassList, specifier?: string) {
    const isArray = Array.isArray(type);
    const fieldConf: FieldConfig = {
      owner: target,
      name: prop,
      array: isArray,
      type: isArray ? (type as any)[0] : type,
      specifier
    };

    return this.registerPendingFieldFacet(target, prop, fieldConf);
  }

  mergeConfigs(dest: ClassConfig, src: ClassConfig) {
    dest.views[ALL_VIEW] = {
      schema: { ...dest.views[ALL_VIEW].schema, ...src.views[ALL_VIEW].schema },
      fields: [...dest.views[ALL_VIEW].fields, ...src.views[ALL_VIEW].fields]
    };
    dest.title = src.title || dest.title;
    dest.validators = [...src.validators, ...dest.validators];
    return dest;
  }

  finalizeViews<T>(target: Class<T>, conf: ClassConfig) {
    const allViewConf = conf.views![ALL_VIEW];
    const pending = this.pendingViews.get(target) || new Map();
    this.pendingViews.delete(target);

    for (const [view, fields] of pending.entries()) {
      const withoutSet = fields.without ? new Set(fields.without as string[]) : undefined;
      const fieldList = withoutSet ?
        allViewConf.fields.filter(x => !withoutSet.has(x)) :
        fields.with as string[];

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

  onInstall(cls: Class, e: ChangeEvent<Class>) {
    super.onInstall(cls, e);

    if (Env.watch && this.has(cls)) {
      this.trackSchemaDependencies(cls);
    }
  }

  onUninstall<T>(cls: Class<T>, e: ChangeEvent<Class>) {
    super.onUninstall(cls, e);
    if (e.type === 'removing' && this.hasExpired(cls)) {
      // Recompute subtypes
      this.subTypes.clear();
      for (const el of this.entries.keys()) {
        const clz = this.entries.get(el)!.class;
        this.registerSubTypes(clz, this.getSubTypeName(clz));
      }

      SchemaChangeListener.clearSchemaDependency(cls);
    }
  }

  emit(ev: ChangeEvent<Class>) {
    super.emit(ev);
    if (ev.type === 'changed') {
      SchemaChangeListener.emitFieldChanges({
        type: 'changed',
        curr: this.get(ev.curr!),
        prev: this.getExpired(ev.curr!)
      });
    }
  }

  onSchemaChange(cb: (ev: SchemaChangeEvent) => void) {
    SchemaChangeListener.on(SCHEMA_CHANGE_EVENT, cb);
  }

  onFieldChange<T>(callback: (e: FieldChangeEvent) => any): void {
    SchemaChangeListener.on(FIELD_CHANGE_EVENT, callback);
  }

}

export const SchemaRegistry = new $SchemaRegistry();