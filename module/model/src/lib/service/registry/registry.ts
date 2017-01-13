import { Cls, ClsList, FieldCfg, ModelCls, ModelConfig } from './types';
import * as mongoose from 'mongoose';

export class ModelRegistry {

  static models: { [name: string]: ModelConfig } = {};
  static DEFAULT_VIEW = 'all';


  static getAllProtoypeNames<T>(cls: Cls<T>) {
    const out: string[] = [];
    while (cls && cls.name && ModelRegistry.models[cls.name]) {
      out.push(cls.name);
      cls = Object.getPrototypeOf(cls) as Cls<T>;
    }
    return out;
  }

  static getViewConfig<T>(target: string | ModelCls<T>, view: string) {
    let mconf = ModelRegistry.getModelConfig(target);
    let viewConf = mconf.views[view];
    if (!viewConf) {
      viewConf = mconf.views[view] = {
        schema: {},
        fields: []
      };
    }
    return viewConf;
  }

  static getSchema<T>(cls: Cls<T>) {
    let conf = ModelRegistry.models[cls.name];
    return conf && conf.views[ModelRegistry.DEFAULT_VIEW].schema;
  }

  static getModelConfig<T>(cls: string | ModelCls<T>) {
    let name = typeof cls === 'string' ? cls : cls.name;
    if (!ModelRegistry.models[name] && name) {
      ModelRegistry.models[name] = {
        indices: [],
        views: {
          [ModelRegistry.DEFAULT_VIEW]: {
            schema: {},
            fields: []
          }
        }
      };
    }
    return ModelRegistry.models[name];
  }

  static registerFieldFacet(target: any, prop: string, config: any, view: string = ModelRegistry.DEFAULT_VIEW) {
    let cons = target.constructor;
    let defViewConf = ModelRegistry.getViewConfig(cons, ModelRegistry.DEFAULT_VIEW);

    if (!defViewConf.schema[prop]) {
      defViewConf.fields.push(prop);
      defViewConf.schema[prop] = {} as any;
    }

    if (view !== ModelRegistry.DEFAULT_VIEW) {
      let viewConf = ModelRegistry.getViewConfig(cons, view);
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
    const fieldConf: FieldCfg = {
      type,
      declared: { array: isArray, type: isArray ? (type as any)[0] : type }
    };

    // Get schema if exists
    const schema = ModelRegistry.getSchema(fieldConf.declared.type);

    if (schema) {
      fieldConf.type = isArray ? [schema] : schema;
    }

    return fieldConf;
  }

  static registerModelFacet<T>(cls: ModelCls<T>, data: any) {
    let conf = ModelRegistry.getModelConfig(cls);
    Object.assign(conf, data);
    cls.collection = conf.collection;
    return cls;
  }

  static registerModel<T>(cls: ModelCls<T>, schemaOpts: mongoose.SchemaOptions = {}) {
    let names = ModelRegistry.getAllProtoypeNames(cls).slice(1);
    let mconf = ModelRegistry.getModelConfig(cls);

    // Flatten views, fields, schemas
    for (let name of names) {
      for (let v of Object.keys(ModelRegistry.models[name].views)) {
        let sViewConf = ModelRegistry.getViewConfig(name, v);
        let viewConf = ModelRegistry.getViewConfig(cls, v);

        Object.assign(viewConf.schema, sViewConf.schema);
        viewConf.fields = viewConf.fields.concat(sViewConf.fields);
      }
    }

    Object.assign(mconf, { collection: mconf.collection || cls.name, schemaOpts });
    return cls;
  }
}