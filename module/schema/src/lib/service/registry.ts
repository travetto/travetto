import { Cls, ClsList, FieldConfig, ClassConfig } from './types';

export class SchemaRegistry {

  static schemas: { [name: string]: ClassConfig } = {};
  static DEFAULT_VIEW = 'all';

  static getAllProtoypeNames<T>(cls: Cls<T>) {
    const out: string[] = [];
    while (cls && cls.name && SchemaRegistry.schemas[cls.name]) {
      out.push(cls.name);
      cls = Object.getPrototypeOf(cls) as Cls<T>;
    }
    return out;
  }

  static getViewConfig<T>(target: string | Cls<T>, view: string) {
    let mconf = SchemaRegistry.getSchemaConfig(target);
    let viewConf = mconf.views[view];
    if (!viewConf) {
      viewConf = mconf.views[view] = {
        schema: {},
        fields: []
      };
    }
    return viewConf;
  }

  static getViewSchema<T>(cls: Cls<T>, view: string = SchemaRegistry.DEFAULT_VIEW) {
    let conf = SchemaRegistry.schemas[cls.name];
    return conf && conf.views[view].schema;
  }

  static getSchemaConfig<T>(cls: string | Cls<T>) {
    let name = typeof cls === 'string' ? cls : cls.name;
    if (!SchemaRegistry.schemas[name] && name) {
      SchemaRegistry.schemas[name] = {
        name,
        subtypes: {},
        metadata: {},
        views: {
          [SchemaRegistry.DEFAULT_VIEW]: {
            schema: {},
            fields: []
          }
        }
      };
    }
    return SchemaRegistry.schemas[name];
  }

  static registerFieldFacet(target: any, prop: string, config: any, view: string = SchemaRegistry.DEFAULT_VIEW) {
    let cons = target.constructor;
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
      metadata: {},
      declared: { array: isArray, type: isArray ? (type as any)[0] : type }
    };

    // Get schema if exists
    const schema = SchemaRegistry.getViewSchema(fieldConf.declared.type);

    if (schema) {
      fieldConf.type = isArray ? [schema] : schema;
    }

    return fieldConf;
  }

  static registerSchemaFacet<T>(cls: Cls<T>, data: any) {
    let conf = SchemaRegistry.getSchemaConfig(cls);
    Object.assign(conf, data);
    return cls;
  }

  static registerSchema<T>(cls: Cls<T>) {
    let names = SchemaRegistry.getAllProtoypeNames(cls).slice(1);
    let mconf = SchemaRegistry.getSchemaConfig(cls);

    // Flatten views, fields, schemas
    for (let name of names) {
      for (let v of Object.keys(SchemaRegistry.schemas[name].views)) {
        let sViewConf = SchemaRegistry.getViewConfig(name, v);
        let viewConf = SchemaRegistry.getViewConfig(cls, v);

        Object.assign(viewConf.schema, sViewConf.schema);
        viewConf.fields = viewConf.fields.concat(sViewConf.fields);
      }
    }

    Object.assign(mconf, { name: mconf.name || cls.name });
    return cls;
  }
}