import { ReviewService } from '../../../../../../../src/app/service/review';
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

export function registerFieldFacet(target: any, prop: string, config: any, view: string = DEFAULT_VIEW) {
  let mconf = getModelConfig(target.constructor);

  if (!mconf.schemas[view]) {
    mconf.schemas[view] = {};
    mconf.views.push(view);
  }
  if (!mconf.schemas[DEFAULT_VIEW][prop]) {
    mconf.fields.push(prop);
    mconf.schemas[DEFAULT_VIEW][prop] = {};
  }

  if (view !== DEFAULT_VIEW) {
    mconf.schemas[view][prop] = mconf.schemas[DEFAULT_VIEW][prop];
  }

  Object.assign(mconf.schemas[DEFAULT_VIEW][prop], config);

  return target;
}

export function getSchema(cls: Cls) {
  let conf = getModelConfig(cls);
  return conf && conf.schemas[DEFAULT_VIEW];
}

export function getModelConfig<T>(cls: string | ModelCls<T>) {
  let name = typeof cls === 'string' ? cls : cls.name;
  if (!models[name] && name) {
    models[name] = {
      schemas: { [DEFAULT_VIEW]: {} },
      fields: [],
      indices: [],
      views: [DEFAULT_VIEW],
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
    for (let v of models[name].views) {
      if (!seen[v]) {
        seen[v] = true;
        views.push(v);
        schemas[v] = schemas[v] || {};
      }
      Object.assign(schemas[v], smconf.schemas[v]);
    }
    fields = fields.concat(smconf.fields)
  }

  registerModelFacet(cls, {
    collection: mconf.collection || cls.name,
    schemaOpts, fields, schemas, views
  });
  return cls;
}