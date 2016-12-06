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

export function Field(type: ClsLst) {
  return (f: any, prop: string) => {
    console.log('Field of type', Reflect.getMetadata('design:type', f, prop));
    registerFieldFacet(f, prop, buildFieldConfig(type));
  };
}

export function Required() {
  return (f: any, prop: string) => {
    registerFieldFacet(f, prop, { required: true });
  };
}

export function Enum(values: string[] | any) {
  return (f: any, prop: string) => {
    registerFieldFacet(f, prop, {
      enum: Array.isArray(values) ? values : enumKeys(values)
    });
  };
}

export function Trimmed() {
  return (f: any, prop: string) => {
    registerFieldFacet(f, prop, { trim: true });
  };
}

export function Match(regExp: RegExp) {
  return (f: any, prop: string) => {
    registerFieldFacet(f, prop, { regExp });
  };
}

export function MinLength(minlength: number) {
  return (f: any, prop: string) => {
    registerFieldFacet(f, prop, { minlength });
  };
}

export function MaxLength(maxlength: number) {
  return (f: any, prop: string) => {
    registerFieldFacet(f, prop, { maxlength });
  };
}

export function Min(min: number | Date) {
  return (f: any, prop: string) => {
    registerFieldFacet(f, prop, { min });
  };
}

export function Max(max: number | Date) {
  return (f: any, prop: string) => {
    registerFieldFacet(f, prop, { max });
  };
}

export function View(...names: string[]) {
  return (f: any, prop: string) => {
    for (let name of names) {
      registerFieldFacet(f, prop, {}, name);
    }
  };
}
