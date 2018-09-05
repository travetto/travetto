import { SchemaRegistry } from '../registry';
import { CommonRegExp } from '../service/regexp';
import { ClassList, FieldConfig } from '../types';

function prop<T = any>(obj: { [key: string]: any }) {
  return (f: any, p: string) => {
    SchemaRegistry.registerPendingFieldFacet(f.constructor, p, obj);
  };
}

function enumKeys(c: any): string[] {
  if (Array.isArray(c) && typeof c[0] === 'string') {
    return c;
  } else {
    return Object.values(c).filter((x: any) => typeof x === 'string') as string[];
  }
}
export function Field(type: ClassList, config?: Partial<FieldConfig>) {
  return (f: any, p: string) => {
    SchemaRegistry.registerPendingFieldConfig(f.constructor, p, type);
    if (config) {
      SchemaRegistry.registerPendingFieldFacet(f.constructor, p, config);
    }
  };
}
export const Alias = (...aliases: string[]) => prop({ aliases });
export const Required = (message?: string) => prop({ required: { active: true, message } });
export const Enum = ((vals: string[] | any, message?: string) => {
  const values = enumKeys(vals);
  message = message || `{path} is only allowed to be "${values.join('" or "')}"`;
  return prop<string | number>({ enum: { values, message } });
});
export const Trimmed = () => prop<string>({ trim: true });
export const Match = (re: RegExp, message?: string) => prop<string>({ match: { re, message } });
export const MinLength = (n: number, message?: string) => prop({ minlength: { n, message } });
export const MaxLength = (n: number, message?: string) => prop({ maxlength: { n, message } });
export const Min = <T extends number | Date>(n: T, message?: string) => prop<Date | number>({ min: { n, message } });
export const Max = <T extends number | Date>(n: T, message?: string) => prop<Date | number>({ max: { n, message } });
export const Email = (message?: string) => Match(CommonRegExp.email, message);
export const Telephone = (message?: string) => Match(CommonRegExp.telephone, message);
export const Url = (message?: string) => Match(CommonRegExp.url, message);
export const Precision = (precision: number) => prop<number>({ precision });
export const Integer = () => Precision(0);
export const Float = () => Precision(10);
export const Currency = () => Precision(2);

export function View(...names: string[]) {
  return (f: any, p: string) => {
    for (const name of names) {
      SchemaRegistry.registerPendingFieldFacet(f.constructor, p, {}, name);
    }
  };
}

// For Auto schemas
export function Ignore(): PropertyDecorator {
  return (target: any, property: string | symbol) => { };
}
