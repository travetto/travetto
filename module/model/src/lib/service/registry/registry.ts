import { Cls, ModelCls, ModelConfig } from './types';
import * as mongoose from 'mongoose';

export class SchemaRegistry {

  static models: { [name: string]: ModelConfig } = {};
  static DEFAULT_VIEW = 'all';


  static getAllProtoypeNames(cls: Cls) {
    const out: string[] = [];
    while (cls && cls.name && SchemaRegistry.models[cls.name]) {
      out.push(cls.name);
      cls = Object.getPrototypeOf(cls) as Cls;
    }
    return out;
  }

  static getViewConfig<T>(target: string | ModelCls<T>, view: string) {
    let mconf = SchemaRegistry.getModelConfig(target);
    let viewConf = mconf.views[view];
    if (!viewConf) {
      viewConf = mconf.views[view] = {
        schema: {},
        fields: []
      };
    }
    return viewConf;
  }

  static getSchema(cls: Cls) {
    let conf = SchemaRegistry.models[cls.name];
    return conf && conf.views[SchemaRegistry.DEFAULT_VIEW].schema;
  }

  static getModelConfig<T>(cls: string | ModelCls<T>) {
    let name = typeof cls === 'string' ? cls : cls.name;
    if (!SchemaRegistry.models[name] && name) {
      SchemaRegistry.models[name] = {
        indices: [],
        views: {
          [SchemaRegistry.DEFAULT_VIEW]: {
            schema: {},
            fields: []
          }
        }
      };
    }
    return SchemaRegistry.models[name];
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

  static registerModelFacet<T>(cls: ModelCls<T>, data: any) {
    let conf = SchemaRegistry.getModelConfig(cls);
    Object.assign(conf, data);
    cls.collection = conf.collection;
    return cls;
  }

  static registerModel<T>(cls: ModelCls<T>, schemaOpts: mongoose.SchemaOptions = {}) {
    let names = SchemaRegistry.getAllProtoypeNames(cls).slice(1);
    let mconf = SchemaRegistry.getModelConfig(cls);

    // Flatten views, fields, schemas
    for (let name of names) {
      for (let v of Object.keys(SchemaRegistry.models[name].views)) {
        let sViewConf = SchemaRegistry.getViewConfig(name, v);
        let viewConf = SchemaRegistry.getViewConfig(cls, v);

        Object.assign(viewConf.schema, sViewConf.schema);
        viewConf.fields = viewConf.fields.concat(sViewConf.fields);
      }
    }

    Object.assign(mconf, { collection: mconf.collection || cls.name, schemaOpts });
    return cls;
  }
}