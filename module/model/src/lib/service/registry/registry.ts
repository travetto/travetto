import { Cls, ModelCls, ModelConfig } from './types';
import * as mongoose from "mongoose";

const schemas: { [name: string]: any } = {};
const fields: { [name: string]: string[] } = {};
const models: { [name: string]: ModelConfig } = {}
const views: { [name: string]: string[] } = {}
export const DEFAULT_VIEW = 'all';

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

export function registerFieldFacet(target: any, prop: string, config: any, view: string = DEFAULT_VIEW) {
  const simpleName = target.constructor.name;
  const name = `${simpleName}::${view}`;

  if (!views[simpleName]) {
    views[simpleName] = [];
  }
  if (!schemas[name]) {
    fields[name] = [];
    schemas[name] = {};
  }
  if (!schemas[name][prop]) {
    fields[name].push(prop);
    schemas[name][prop] = {};
  }

  views[simpleName].push(view);

  Object.assign(schemas[name][prop], config);
  if (view !== DEFAULT_VIEW) {
    let def = `${target.constructor.name}::${DEFAULT_VIEW}`;
    if (!schemas[def]) registerFieldFacet(target, prop, {});
    schemas[name][prop] = schemas[def][prop];
  }
  return target;
}

export function getSchema(name: string, view: string = DEFAULT_VIEW) {
  return schemas[`${name}::${view}`];
}

export function getModelConfig<T>(cls: ModelCls<T>) {
  if (!models[cls.name]) {
    models[cls.name] = {
      schemas: {},
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
  let finalSchemas: { [key: string]: { [key: string]: any } } = {};

  let allViews = names.reduce((acc: string[], x: string) =>
    acc.concat(
      views[x].filter(y => acc.indexOf(y) < 0)), []);

  for (let view of allViews) {
    finalSchemas[view] = Object.assign({}, ...names.map(x => schemas[`${x}::${view}`]));
  }

  registerModelFacet(cls, {
    collection: config.collection || cls.name,
    schemaOpts: opts,
    fields: ([] as string[]).concat(...names.map(x => fields[x])),
    schemas: finalSchemas
  });
  return cls;
}