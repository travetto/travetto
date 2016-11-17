import { Cls, ModelCls, ModelConfig } from './types';
import * as mongoose from "mongoose";

const models: { [name: string]: ModelConfig } = {}
export const DEFAULT_VIEW = 'all';

export function getAllProtoypeNames(cls: Cls) {
  const out: string[] = [];
  while (cls && cls.name && models[cls.name]) {
    out.push(cls.name);
    cls = Object.getPrototypeOf(cls) as Cls;
  }
  return out;
}

export function getViewconf(target: any, view: string) {
  let mconf = getModelConfig(target.constructor);
  let viewConf = mconf.views[view];
  if (!viewConf) {
    viewConf = mconf.views[view] = {
      schema: {},
      fields: []
    }
  }
  return viewConf;
}

export function registerFieldFacet(target: any, prop: string, config: any, view: string = DEFAULT_VIEW) {
  let mconf = getModelConfig(target.constructor);
  let defViewConf = getViewconf(target, DEFAULT_VIEW);

  if (!defViewConf.schema[prop]) {
    defViewConf.fields.push(prop);
    defViewConf.schema[prop] = {};
  }

  if (view !== DEFAULT_VIEW) {
    let viewConf = getViewconf(target, view);
    if (!viewConf.schema[prop]) {
      viewConf.schema[prop] = defViewConf.schema[prop];
      viewConf.fields.push(prop);
    }
  }

  Object.assign(defViewConf.schema[prop], config);

  return target;
}

export function getSchema(cls: Cls) {
  let conf = models[cls.name];
  return conf && conf.views[DEFAULT_VIEW].schema;
}

export function getModelConfig<T>(cls: string | ModelCls<T>) {
  let name = typeof cls === 'string' ? cls : cls.name;
  if (!models[name] && name) {
    models[name] = {
      indices: [],
      views: {
        [DEFAULT_VIEW]: {
          schema: {},
          fields: [],
        }
      }
    };
  }
  return models[name];
}

export function registerModelFacet<T>(cls: ModelCls<T>, data: any) {
  let conf = getModelConfig(cls);
  Object.assign(conf, data);
  cls.collection = conf.collection;
  return cls;
}

export function registerModel<T>(cls: ModelCls<T>, schemaOpts: mongoose.SchemaOptions = {}) {
  let names = getAllProtoypeNames(cls);
  let mconf = getModelConfig(cls);

  let schemas: { [key: string]: { [key: string]: any } } = {};
  let fields: string[] = [];

  //Flatten views, fields, schemas
  let views: string[] = [], seen: { [key: string]: boolean } = {};
  for (let name of names) {
    let smconf = getModelConfig(name);
    for (let v of Object.keys(models[name].views)) {
      if (!seen[v]) {
        seen[v] = true;
        views.push(v);
        schemas[v] = schemas[v] || {};
      }
      Object.assign(mconf.views[v].schema, smconf.views[v].schema);
      mconf.views[v].fields = mconf.views[v].fields.concat(smconf.views[v].fields);
    }
  }
  Object.assign(mconf, { collection: mconf.collection || cls.name, schemaOpts });
  return cls;
}