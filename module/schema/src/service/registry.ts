import { Cls, ClsList, FieldConfig, ClassConfig, ViewConfig } from './types';

export class SchemaRegistry {

  static schemas: Map<Cls<any>, ClassConfig> = new Map();
  static DEFAULT_VIEW = 'all';

  static getParent(cls: Cls<any>): Cls<any> | null {
    let parent = Object.getPrototypeOf(cls) as Cls<any>;
    return parent.name && parent !== Object ? parent : null;
  }

  static getViewConfig<T>(target: Cls<T>, view: string) {
    let conf = SchemaRegistry.getClassConfig(target);
    let viewConf = conf.views[view];
    if (!viewConf) {
      viewConf = conf.views[view] = {
        schema: {},
        fields: []
      };
    }
    return viewConf;
  }

  static getViewSchema<T>(cls: Cls<T>, view: string = SchemaRegistry.DEFAULT_VIEW) {
    let conf = SchemaRegistry.schemas.get(cls);
    return conf && conf.views[view].schema;
  }

  static getClassConfig<T>(cls: Cls<T>) {
    if (!SchemaRegistry.schemas.has(cls)) {

      // Project super types to sub types on access
      let views: { [key: string]: ViewConfig } = {
        [SchemaRegistry.DEFAULT_VIEW]: {
          schema: {},
          fields: []
        }
      };

      let parent = SchemaRegistry.getParent(cls);
      if (parent) {
        let parentConfig = SchemaRegistry.getClassConfig(parent);

        for (let v of Object.keys(parentConfig.views)) {
          let view = parentConfig.views[v];
          views[v] = {
            schema: Object.assign({}, view.schema),
            fields: view.fields.slice(0)
          };
        }
      }

      SchemaRegistry.schemas.set(cls, {
        finalized: false,
        metadata: {},
        views
      });
    }

    return SchemaRegistry.schemas.get(cls) as ClassConfig;
  }

  static registerClassMetadata<T, U>(cls: Cls<T>, key: string, data: U) {
    let conf = SchemaRegistry.getClassConfig(cls);
    conf.metadata[key] = Object.assign({}, conf.metadata[key] || {}, data);
    return cls;
  }

  static getClassMetadata<T, U>(cls: Cls<T>, key: string): U {
    let metadata = SchemaRegistry.getClassConfig(cls).metadata;
    if (!metadata[key]) {
      metadata[key] = {};
    }
    return metadata[key] as U;
  }

  static getCls<T>(o: T): Cls<T> {
    return o.constructor as any;
  }

  static registerFieldFacet(target: any, prop: string, config: any, view: string = SchemaRegistry.DEFAULT_VIEW) {
    let cons = SchemaRegistry.getCls(target);
    let defViewConf = SchemaRegistry.getViewConfig(cons, SchemaRegistry.DEFAULT_VIEW);

    if (!defViewConf.schema[prop]) {
      defViewConf.fields.push(prop);
      defViewConf.schema[prop] = {} as any;
    }

    if (view !== SchemaRegistry.DEFAULT_VIEW) {
      let viewConf = SchemaRegistry.getViewConfig(cons, view);
      if (!viewConf.schema[prop]) {
        viewConf.schema[prop] = defViewConf.schema[prop];
        viewConf.fields.push(prop);
      }
    }

    Object.assign(defViewConf.schema[prop], config);

    return target;
  }

  static registerFieldConfig(target: any, prop: string, type: ClsList) {
    const isArray = Array.isArray(type);
    const fieldConf: FieldConfig = {
      type,
      name: prop,
      declared: {
        array: isArray, type: isArray ? (type as any)[0] : type
      }
    };

    // Get schema if exists
    const schema = SchemaRegistry.getViewSchema(fieldConf.declared.type);

    if (schema) {
      fieldConf.type = isArray ? [schema] : schema;
    }

    return SchemaRegistry.registerFieldFacet(target, prop, fieldConf);
  }

  static registerClassFacet<T>(cls: Cls<T>, config: any) {
    let conf = SchemaRegistry.getClassConfig(cls);
    if (config && config['metadata']) {
      config['metadata'] = Object.assign({}, conf.metadata, config['metadata']);
    }
    Object.assign(conf, config);
    return cls;
  }
}