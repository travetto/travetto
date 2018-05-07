import { ClassList, FieldConfig, ClassConfig, ViewConfig } from './types';
import { MetadataRegistry, RootRegistry, Class } from '@travetto/registry';

export class $SchemaRegistry extends MetadataRegistry<ClassConfig> {

  static DEFAULT_VIEW = '__all';
  DEFAULT_VIEW = $SchemaRegistry.DEFAULT_VIEW;

  constructor() {
    super(RootRegistry);
  }

  createPending(cls: Class) {
    return {
      class: cls,
      views: {
        [$SchemaRegistry.DEFAULT_VIEW]: {
          schema: {},
          fields: []
        }
      }
    };
  }

  getPendingViewSchema<T>(cls: Class<T>, view?: string) {
    view = view || $SchemaRegistry.DEFAULT_VIEW;

    if (cls.__id) {
      const conf = this.getOrCreatePending(cls);
      return conf.views![view].schema;
    } else {
      return;
    }
  }

  getViewSchema<T>(cls: Class<T>, view?: string) {
    const res = this.get(cls)!.views[view || SchemaRegistry.DEFAULT_VIEW];
    if (!res) {
      throw new Error(`Unknown view ${view || SchemaRegistry.DEFAULT_VIEW} for ${cls.name}`);
    }
    return res;
  }

  getOrCreatePendingViewConfig<T>(target: Class<T>, view?: string) {
    view = view || $SchemaRegistry.DEFAULT_VIEW;

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
    view = view || $SchemaRegistry.DEFAULT_VIEW;

    const defViewConf = this.getOrCreatePendingViewConfig(target);

    if (!defViewConf.schema[prop]) {
      defViewConf.fields.push(prop);
      defViewConf.schema[prop] = {} as any;
    }

    if (view !== $SchemaRegistry.DEFAULT_VIEW) {
      const viewConf = this.getOrCreatePendingViewConfig(target, view);
      if (!viewConf.schema[prop]) {
        viewConf.schema[prop] = defViewConf.schema[prop];
        viewConf.fields.push(prop);
      }
    }

    Object.assign(defViewConf.schema[prop], config);

    return target;
  }

  registerPendingFieldConfig(target: Class, prop: string, type: ClassList) {
    const isArray = Array.isArray(type);
    const fieldConf: FieldConfig = {
      type,
      name: prop,
      declared: {
        array: isArray, type: isArray ? (type as any)[0] : type
      }
    };

    // Get schema if exists
    const schema = this.getPendingViewSchema(target);

    if (schema) {
      fieldConf.type = isArray ? [schema] : schema;
    }

    return this.registerPendingFieldFacet(target, prop, fieldConf);
  }

  mergeConfigs(dest: ClassConfig, src: ClassConfig) {
    for (const v of Object.keys(src.views)) {
      const view = src.views[v];
      if (v in dest.views) {
        dest.views[v] = {
          schema: { ...dest.views[v].schema, ...view.schema },
          fields: (dest.views[v].fields).concat(view.fields)
        }
      } else {
        dest.views[v] = {
          schema: { ...(view.schema || {}) },
          fields: view.fields.slice(0)
        }
      }
    }
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

    // Merge pending
    const pending = this.getOrCreatePending(cls);
    if (pending) {
      config = this.mergeConfigs(config, pending as ClassConfig);
    }

    return config;
  }
}

export const SchemaRegistry = new $SchemaRegistry();