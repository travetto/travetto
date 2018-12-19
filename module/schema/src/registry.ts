import { MetadataRegistry, RootRegistry, Class, ChangeEvent } from '@travetto/registry';
import { Env } from '@travetto/base';
import { ClassList, FieldConfig, ClassConfig, DEFAULT_VIEW } from './types';
import {
  SchemaChangeListener,
  SchemaChangeEvent, FieldChangeEvent,
  SCHEMA_CHANGE_EVENT, FIELD_CHANGE_EVENT
} from './service/changes';

export class $SchemaRegistry extends MetadataRegistry<ClassConfig, FieldConfig> {

  subTypes = new Map<Class, Map<string, Class>>();

  constructor() {
    super(RootRegistry);
  }

  resolveSubTypeForInstance<T>(cls: Class<T>, o: T) {
    return this.resolveSubType(cls, (o as any).type || o.constructor);
  }

  resolveSubType(cls: Class, type: Class | string) {
    return (this.subTypes.has(cls) && this.subTypes.get(cls)!.get(typeof type === 'string' ? type : type.__id)!) || cls;
  }

  getDefaultSubTypeName(cls: Class) {
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

  computeSchemaDependencies(cls: Class, curr: Class = cls, path: string[] = []) {
    const config = this.get(curr);

    SchemaChangeListener.trackSchemaDependency(curr, cls, path, this.get(cls));

    // Read children
    const view = config.views[DEFAULT_VIEW];
    for (const k of view.fields) {
      if (this.has(view.schema[k].type)) {
        this.computeSchemaDependencies(cls, view.schema[k].type, [...path, k]);
      }
    }
  }

  createPending(cls: Class) {
    return {
      class: cls,
      validators: [],
      views: {
        [DEFAULT_VIEW]: {
          schema: {},
          fields: []
        }
      }
    };
  }

  getPendingViewSchema<T>(cls: Class<T>, view?: string) {
    view = view || DEFAULT_VIEW;

    if (cls.__id) {
      const conf = this.getOrCreatePending(cls);
      return conf.views![view].schema;
    } else {
      return;
    }
  }

  getViewSchema<T>(cls: Class<T>, view?: string) {
    const schm = this.get(cls)!;
    if (!schm) {
      throw new Error(`Unknown schema class ${cls.name}`);
    }
    const res = schm.views[view || DEFAULT_VIEW];
    if (!res) {
      throw new Error(`Unknown view ${view || DEFAULT_VIEW} for ${cls.name}`);
    }
    return res;
  }

  getOrCreatePendingViewConfig<T>(target: Class<T>, view?: string) {
    view = view || DEFAULT_VIEW;

    const conf = this.getOrCreatePending(target);

    let viewConf = conf.views![view];
    if (!viewConf) {
      viewConf = conf.views![view] = {
        schema: {},
        fields: []
      };
    }
    return viewConf;
  }

  registerPendingFieldFacet(target: Class, prop: string, config: any, view?: string) {
    view = view || DEFAULT_VIEW;

    const defViewConf = this.getOrCreatePendingViewConfig(target);

    if (!defViewConf.schema[prop]) {
      defViewConf.fields.push(prop);
      defViewConf.schema[prop] = {} as any;
    }

    if (view !== DEFAULT_VIEW) {
      const viewConf = this.getOrCreatePendingViewConfig(target, view);
      if (!viewConf.schema[prop]) {
        viewConf.schema[prop] = defViewConf.schema[prop];
        viewConf.fields.push(prop);
      }
    }

    Object.assign(defViewConf.schema[prop], config);

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
    for (const v of Object.keys(src.views)) {
      const view = src.views[v];
      if (v in dest.views) {
        dest.views[v] = {
          schema: { ...dest.views[v].schema, ...view.schema },
          fields: (dest.views[v].fields).concat(view.fields)
        };
      } else {
        dest.views[v] = {
          schema: { ...(view.schema || {}) },
          fields: view.fields.slice(0)
        };
      }
    }
    dest.title = src.title || dest.title;
    dest.validators = [...src.validators, ...dest.validators];
    return dest;
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

    this.registerSubTypes(cls, this.getDefaultSubTypeName(cls));

    // Merge pending
    const pending = this.getOrCreatePending(cls);
    if (pending) {
      config = this.mergeConfigs(config, pending as ClassConfig);
    }

    return config;
  }

  onInstall(cls: Class, e: ChangeEvent<Class>) {
    super.onInstall(cls, e);

    if (Env.watch && this.has(cls)) {
      this.computeSchemaDependencies(cls);
    }
  }

  onUninstall<T>(cls: Class<T>, e: ChangeEvent<Class>) {
    super.onUninstall(cls, e);
    if (e.type === 'removing' && this.hasExpired(cls)) {
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