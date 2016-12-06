import { enumKeys } from '../util';
import { Cls, FieldCfg, ClsLst, registerFieldFacet, getSchema } from '../service/registry';
import 'reflect-metadata';

function buildFieldConfig(type: ClsLst) {
  const isArray = Array.isArray(type);
  const fieldConf: FieldCfg = { type };
  const fieldType: Cls = Array.isArray(type) ? type[0] : type;

  // Get schema if exists
  const schema = getSchema(fieldType);

  if (schema) {
    fieldConf.type = isArray ? [schema] : schema;
  }

  return fieldConf;
}

function prop(obj: { [key: string]: any }) {
  return (f: any, prop: string) => {
    registerFieldFacet(f, prop, obj);
  };
}

export function Field(type: ClsLst) {
  return (f: any, prop: string) => {
    console.log('Field of type', Reflect.getMetadata('design:type', f, prop));
    registerFieldFacet(f, prop, buildFieldConfig(type));
  };
}

export const Required = () => prop({ required: true });
export const Enum = (vals: string[] | any) => prop({ enum: Array.isArray(vals) ? vals : enumKeys(vals) });
export const Trimmed = () => prop({ trim: true });
export const Match = (re: RegExp) => prop({ regExp: re });
export const MinLength = (n: number) => prop({ minlength: n });
export const MaxLength = (n: number) => prop({ maxlength: n });
export const Min = (n: number | Date) => prop({ min: n });
export const Max = (n: number | Date) => prop({ max: n });

export function View(...names: string[]) {
  return (f: any, prop: string) => {
    for (let name of names) {
      registerFieldFacet(f, prop, {}, name);
    }
  };
}
