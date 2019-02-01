import { SchemaRegistry } from '../registry';
import { CommonRegExp } from '../service/regexp';
import { ClassList, FieldConfig } from '../types';

function prop(obj: { [key: string]: any }) {
  return (t: any, k: string) => {
    SchemaRegistry.registerPendingFieldFacet(t.constructor, k, obj);
  };
}

const stringProp = prop as
  (obj: { [key: string]: any }) =>
    <T extends Partial<Record<K, string>>, K extends string>(t: T, k: K) =>
      void;

const stringArrProp = prop as
  (obj: { [key: string]: any }) =>
    <T extends Partial<Record<K, string | any[]>>, K extends string>(t: T, k: K) =>
      void;

const stringArrStringProp = prop as
  (obj: { [key: string]: any }) =>
    <T extends Partial<Record<K, string | string[]>>, K extends string>(t: T, k: K) =>
      void;

const numberProp = prop as
  (obj: { [key: string]: any }) =>
    <T extends Partial<Record<K, number>>, K extends string>(t: T, k: K) =>
      void;

const stringNumberProp = prop as
  (obj: { [key: string]: any }) =>
    <T extends Partial<Record<K, string | number>>, K extends string>(t: T, k: K) =>
      void;

const dateNumberProp = prop as
  (obj: { [key: string]: any }) =>
    <T extends Partial<Record<K, Date | number>>, K extends string>(t: T, k: K) =>
      void;

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
export const Required = (active = true, message?: string) => prop({ required: { active, message } });
export const Enum = ((vals: string[] | any, message?: string) => {
  const values = enumKeys(vals);
  message = message || `{path} is only allowed to be "${values.join('" or "')}"`;
  return stringNumberProp({ enum: { values, message } });
});

export const Trimmed = () => stringArrStringProp({ trim: true });
export const Text = () => stringArrStringProp({ specifier: 'text' });
export const LongText = () => stringArrStringProp({ specifier: 'text-long' });

export const Match = (re: RegExp, message?: string) => stringArrStringProp({ match: { re, message } });
export const MinLength = (n: number, message?: string) => stringArrProp({ minlength: { n, message } });
export const MaxLength = (n: number, message?: string) => stringArrProp({ maxlength: { n, message } });
export const Min = <T extends number | Date>(n: T, message?: string) => dateNumberProp({ min: { n, message } });
export const Max = <T extends number | Date>(n: T, message?: string) => dateNumberProp({ max: { n, message } });
export const Email = (message?: string) => Match(CommonRegExp.email, message);
export const Telephone = (message?: string) => Match(CommonRegExp.telephone, message);
export const Url = (message?: string) => Match(CommonRegExp.url, message);
export const Precision = (digits: number, decimals?: number) => numberProp({ precision: [digits, decimals] });
export const Integer = () => Precision(0);
export const Float = () => Precision(10, 7);
export const Currency = () => Precision(13, 2);

// For Auto schemas
export function Ignore(): PropertyDecorator {
  return (target: any, property: string | symbol) => { };
}
