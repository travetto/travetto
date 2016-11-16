import { Cls, ModelCls } from '../model';

export const schemas: { [name: string]: any } = {};
export const fields: { [name: string]: string[] } = {};

export function getAllProtoypeNames(cls: Cls) {
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
