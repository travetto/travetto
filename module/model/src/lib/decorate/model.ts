import * as mongoose from "mongoose";
import { Cls, ModelCls } from '../model';
import { getAllProtoypeNames, fields, schemas } from './registry';

export function Discriminate(key: string) {
  return (a: any) => {
    let parent = Object.getPrototypeOf(a) as ModelCls<any>;
    a.collection = parent.collection;
    a.discriminatorKey = key;
    parent.discriminiators = parent.discriminiators || {};
    parent.discriminiators[key] = a;
    return a;
  };
}

export function DefaultSort(sort: Object) {
  return (target: any) => {
    target.defaultSort = sort;
    return target;
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

