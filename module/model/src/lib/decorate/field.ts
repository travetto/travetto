import * as mongoose from "mongoose";
import { Cls, FieldCfg, ClsLst, ModelCls } from '../model';
import { ObjectUtil } from '@encore/util';
import { fields, schemas } from './registry';

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
