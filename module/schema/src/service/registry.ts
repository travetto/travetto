import { Class, ClassList, FieldConfig, ClassConfig, ViewConfig } from './types';
import { MetadataRegistry, RootRegistry } from '@encore2/registry';

export class $SchemaRegistry extends MetadataRegistry<ClassConfig> {

  static DEFAULT_VIEW = '__all';
  DEFAULT_VIEW = $SchemaRegistry.DEFAULT_VIEW;

  constructor() {
    super(RootRegistry);
  }

  onNewClassConfig(cls: Class) {
    return {
      views: {
        [$SchemaRegistry.DEFAULT_VIEW]: {
          schema: {},
          fields: []
        }
      }
    };
  }

  getParent(cls: Class): Class | null {
    let parent = Object.getPrototypeOf(cls) as Class;
    return parent.name && (parent as any) !== Object ? parent : null;
  }

  getClass<T>(o: T): Class<T> {
    return o.constructor as Class<T>;
  }

  getPendingViewSchema<T>(cls: Class<T>, view?: string) {
    view = view || $SchemaRegistry.DEFAULT_VIEW;

    let conf = this.getOrCreateClassConfig(cls);
    return conf && conf.views![view].schema;
  }

  getViewSchema<T>(cls: Class<T>, view?: string) {
    return this.finalClasses.get(cls.__id)!.views[view || SchemaRegistry.DEFAULT_VIEW];
  }

  getOrCreatePendingViewConfig<T>(target: Class<T>, view?: string) {
    view = view || $SchemaRegistry.DEFAULT_VIEW;

    let conf = this.getOrCreateClassConfig(target);

    let viewConf = conf.views![view];
    if (!viewConf) {
      viewConf = conf.views![view] = {
        schema: {},
        fields: []
      };
    }
    return viewConf;
  }

  registerPendingFieldFacet(target: any, prop: string, config: any, view?: string) {
    view = view || $SchemaRegistry.DEFAULT_VIEW;

    let cons = this.getClass(target);
    let defViewConf = this.getOrCreatePendingViewConfig(cons);

    if (!defViewConf.schema[prop]) {
      defViewConf.fields.push(prop);
      defViewConf.schema[prop] = {} as any;
    }

    if (view !== $SchemaRegistry.DEFAULT_VIEW) {
      let viewConf = this.getOrCreatePendingViewConfig(cons, view);
      if (!viewConf.schema[prop]) {
        viewConf.schema[prop] = defViewConf.schema[prop];
        viewConf.fields.push(prop);
      }
    }

    Object.assign(defViewConf.schema[prop], config);

    return target;
  }

  registerPendingFieldConfig(target: any, prop: string, type: ClassList) {
    const isArray = Array.isArray(type);
    const fieldConf: FieldConfig = {
      type,
      name: prop,
      declared: {
        array: isArray, type: isArray ? (type as any)[0] : type
      }
    };

    // Get schema if exists
    const schema = this.getPendingViewSchema(fieldConf.declared.type);

    if (schema) {
      fieldConf.type = isArray ? [schema] : schema;
    }

    return this.registerPendingFieldFacet(target, prop, fieldConf);
  }

  mergeConfigs(dest: ClassConfig, src: ClassConfig) {
    for (let v of Object.keys(src.views)) {
      let view = src.views[v];
      if (v in dest.views) {
        dest.views[v] = {
          schema: Object.assign({}, dest.views[v].schema, view.schema),
          fields: (dest.views[v].fields).concat(view.fields)
        }
      } else {
        dest.views[v] = {
          schema: Object.assign({}, view.schema || {}),
          fields: view.fields.slice(0)
        }
      }
    }
    return dest;
  }

  onInstallFinalize(cls: Class) {
    let config: ClassConfig = { views: {} };

    // Merge parent
    let parent = this.getParent(cls) as Class;
    if (parent) {
      let parentConfig = this.finalClasses.get(parent.__id);
      if (parentConfig) {
        config = this.mergeConfigs(config, parentConfig);
      }
    }

    // Merge pending
    let pending = this.getOrCreateClassConfig(cls);
    if (pending) {
      config = this.mergeConfigs(config, pending as ClassConfig);
    }

    return config;
  }
}

export const SchemaRegistry = new $SchemaRegistry();