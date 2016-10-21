import * as mongoose from "mongoose";
import { Cls, FieldCfg, ClsLst } from '../model';
import { MongoService } from '@encore/mongo';
import { Ready } from '@encore/init';
import { ObjectUtil } from '@encore/base';
import { Model } from '../model';

let schemas: { [name: string]: any } = {};
let fields: { [name: string]: string[] } = {};

function getAllProtoypeNames(cls: Cls) {
  let out: string[] = [];
  while (cls && cls.name && fields[cls.name]) {
    out.push(cls.name);
    cls = Object.getPrototypeOf(cls) as Cls;
  }
  return out;
}

export function getFieldsForType(cls: Cls) {
  return cls.name ? fields[cls.name] : null;
}

export function Discriminate(key: string) {
  return (a: any) => {
    let parent = Object.getPrototypeOf(a) as Model<any>;
    a.collection = parent.collection;
    a.discriminatorKey = key;
    parent.discriminiators = parent.discriminiators || {};
    parent.discriminiators[key] = a;
    return a;
  };
}

export function Model(opts: mongoose.SchemaOptions = {}) {
  return (a: any) => {
    let names = getAllProtoypeNames(a);
    a.collection = a.schemaName || a.name;
    a.schemaOpts = opts;
    a.fields = ([] as string[]).concat(...names.map(x => fields[x]))
    a.schema = Object.assign({}, ...names.map(x => schemas[x]));
    return a
  }
}

function configObjectCreator(config: FieldCfg | ClsLst) {
  let configObject: FieldCfg = config as any;

  if (!ObjectUtil.isPlainObject(config)) {
    configObject = { type: config as Cls };
  }

  let fieldType: any = configObject.type;
  let isArray = Array.isArray(fieldType)

  if (isArray) {
    fieldType = fieldType[0];
  }

  let isNative = fieldType.toString().indexOf("[native code]") > 0;

  return () => {
    if (!isNative) {
      let schema = fieldType.schema
      if (schema) {
        configObject.type = isArray ? [schema] : schema;
      }
    }

    return configObject;
  }
}

export function Field(config: FieldCfg | ClsLst) {

  let creator = config ? configObjectCreator(config) : null;

  return (target: any, propertyKey: string) => {
    let name = target.constructor.name;
    (fields[name] = fields[name] || []).push(propertyKey);

    if (creator) {
      let val = creator();
      let tname = (Array.isArray(val.type) ? val.type[0].name : val.type.name) || '';
      if (schemas[tname]) {
        val = !Array.isArray(val.type) ? schemas[tname] : [schemas[tname]];
      }
      (schemas[name] = schemas[name] || {})[propertyKey] = val;
    }
  };
}

export function Index(config: { fields: string[], unique?: boolean, sparse?: boolean }) {
  return (a: any) => {
    Ready.waitFor(MongoService.createIndex(a, config)
      .then(x => console.log(`Created index ${config}`)))
    return a;
  }
}

export function Unique(...fields: string[]) {
  return (target: any) => {
    target.unique = target.unique || [];
    target.unique.push(fields);
    Ready.waitFor(MongoService.createIndex(target, { fields, unique: true })
      .then(x => console.log(`Created unique index ${fields}`)))
    return target;
  }
}

export function DefaultSort(sort: Object) {
  return (target: any) => {
    target.defaultSort = sort;
    return target;
  };
}