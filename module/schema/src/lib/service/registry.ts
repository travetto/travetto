import { Cls, ClsList, FieldConfig, ClassConfig } from './types';

export class SchemaRegistry {

  static schemas: Map<Cls<any>, ClassConfig> = new Map();
  static DEFAULT_VIEW = 'all';

  static getAllProtoypes<T>(cls: Cls<T>) {
    const out: Cls<any>[] = [];
    while (cls && cls.name && SchemaRegistry.schemas.has(cls)) {
      out.push(cls);
      cls = Object.getPrototypeOf(cls) as Cls<T>;
    }
    return out;
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
      SchemaRegistry.schemas.set(cls, {
        name: cls.name,
        metadata: {},
        views: {
          [SchemaRegistry.DEFAULT_VIEW]: {
            schema: {},
            fields: []
          }
        }
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
    return SchemaRegistry.getClassConfig(cls).metadata[key] as U;
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

  static buildFieldConfig(type: ClsList) {
    const isArray = Array.isArray(type);
    const fieldConf: FieldConfig = {
      type,
      declared: { array: isArray, type: isArray ? (type as any)[0] : type }
    };

    // Get schema if exists
    const schema = SchemaRegistry.getViewSchema(fieldConf.declared.type);

    if (schema) {
      fieldConf.type = isArray ? [schema] : schema;
    }

    return fieldConf;
  }

  static registerClassFacet<T>(cls: Cls<T>, config: any) {
    let conf = SchemaRegistry.getClassConfig(cls);
    if (config && config['metadata']) {
      config['metadata'] = Object.assign({}, conf.metadata, config['metadata']);
    }
    Object.assign(conf, config);
    return cls;
  }

  static registerClass<T>(cls: Cls<T>) {
    let classes = SchemaRegistry.getAllProtoypes(cls).slice(1);
    let conf = SchemaRegistry.getClassConfig(cls);

    // Flatten views, fields, schemas
    for (let pcls of classes) {
      let schemaConf = SchemaRegistry.schemas.get(pcls);
      if (schemaConf) {
        for (let v of Object.keys(schemaConf.views)) {
          let sViewConf = SchemaRegistry.getViewConfig(name, v);
          let viewConf = SchemaRegistry.getViewConfig(cls, v);

          Object.assign(viewConf.schema, sViewConf.schema);
          viewConf.fields = viewConf.fields.concat(sViewConf.fields);
        }
      }
    }

    Object.assign(conf, { name: conf.name || cls.name });
    return cls;
  }
}