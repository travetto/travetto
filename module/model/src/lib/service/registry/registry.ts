import { Cls, ModelCls, ModelConfig } from './types';
import * as mongoose from "mongoose";

const schemas: { [name: string]: any } = {};
const fields: { [name: string]: string[] } = {};
const models: { [name: string]: ModelConfig } = {}

export function getAllProtoypeNames(cls: Cls) {
  const out: string[] = [];
  while (cls && cls.name && fields[cls.name]) {
    out.push(cls.name);
    cls = Object.getPrototypeOf(cls) as Cls;
  }
  return out;
}

export function getFieldsForType(cls: Cls) {
  return cls.name ? fields[cls.name] : null;
}

export function registerFieldFacet(target: any, prop: string, config: any) {
  const name = target.constructor.name;
  if (!schemas[name]) {
    fields[name] = [];
    schemas[name] = {};
  }
  if (!schemas[name][prop]) {
    fields[name].push(prop);
    schemas[name][prop] = {};
  }
  Object.assign(schemas[name][prop], config);
  return target;
}

export function getSchema(name: string) {
  return schemas[name];
}

export function getModelConfig<T>(cls: ModelCls<T>) {
  if (!models[cls.name]) {
    models[cls.name] = {
      schema: {},
      fields: [],
      indices: []
    };
  }
  return models[cls.name];
}

export function registerModelFacet<T>(cls: ModelCls<T>, data: any) {
  let conf = getModelConfig(cls);
  Object.assign(conf, data);
  cls.collection = conf.collection;
  return cls;
}

export function registerModel<T>(cls: ModelCls<T>, opts: mongoose.SchemaOptions = {}) {
  let names = getAllProtoypeNames(cls);
  let config = getModelConfig(cls);
  registerModelFacet(cls, {
    collection: config.collection || cls.name,
    schemaOpts: opts,
    fields: ([] as string[]).concat(...names.map(x => fields[x])),
    schema: Object.assign({}, ...names.map(x => schemas[x]))
  });
  return cls;
}