import { SchemaRegistry } from '../service/registry';
import { CommonRegExp } from '../validate/regexp';
import { ClassList, FieldConfig } from '../service/types';

function prop(obj: Record<string, any>) {
  return (t: any, k: string) => {
    SchemaRegistry.registerPendingFieldFacet(t.constructor, k, obj);
  };
}

const stringArrProp = prop as
  (obj: Record<string, any>) => <T extends Partial<Record<K, string | any[]>>, K extends string>(t: T, k: K) => void;

const stringArrStringProp = prop as
  (obj: Record<string, any>) => <T extends Partial<Record<K, string | string[]>>, K extends string>(t: T, k: K) => void;

const numberProp = prop as
  (obj: Record<string, any>) => <T extends Partial<Record<K, number>>, K extends string>(t: T, k: K) => void;

const stringNumberProp = prop as
  (obj: Record<string, any>) => <T extends Partial<Record<K, string | number>>, K extends string>(t: T, k: K) => void;

const dateNumberProp = prop as
  (obj: Record<string, any>) => <T extends Partial<Record<K, Date | number>>, K extends string>(t: T, k: K) => void;

function enumKeys(c: any): string[] {
  if (Array.isArray(c) && typeof c[0] === 'string') {
    return c;
  } else {
    return Object.values(c).filter((x: any) => typeof x === 'string') as string[];
  }
}

// TODO: Document
export function Field(type: ClassList, config?: Partial<FieldConfig>) {
  return (f: any, p: string) => {
    SchemaRegistry.registerPendingFieldConfig(f.constructor, p, type);
    if (config) {
      SchemaRegistry.registerPendingFieldFacet(f.constructor, p, config);
    }
  };
}
// TODO: Document
export const Alias = (...aliases: string[]) => prop({ aliases });
// TODO: Document
export const Required = (active = true, message?: string) => prop({ required: { active, message } });
// TODO: Document
export const Enum = ((vals: string[] | any, message?: string) => {
  const values = enumKeys(vals);
  message = message || `{path} is only allowed to be "${values.join('" or "')}"`;
  return stringNumberProp({ enum: { values, message } });
});

// TODO: Document
export const Trimmed = () => stringArrStringProp({ trim: true });
// TODO: Document
export const Text = () => stringArrStringProp({ specifier: 'text' });
// TODO: Document
export const LongText = () => stringArrStringProp({ specifier: 'text-long' });

// TODO: Document
export const Match = (re: RegExp, message?: string) => stringArrStringProp({ match: { re, message } });
// TODO: Document
export const MinLength = (n: number, message?: string) => stringArrProp({ minlength: { n, message }, ...(n === 0 ? { required: { active: false } } : {}) });
// TODO: Document
export const MaxLength = (n: number, message?: string) => stringArrProp({ maxlength: { n, message } });
// TODO: Document
export const Min = <T extends number | Date>(n: T, message?: string) => dateNumberProp({ min: { n, message } });
// TODO: Document
export const Max = <T extends number | Date>(n: T, message?: string) => dateNumberProp({ max: { n, message } });
// TODO: Document
export const Email = (message?: string) => Match(CommonRegExp.email, message);
// TODO: Document
export const Telephone = (message?: string) => Match(CommonRegExp.telephone, message);
// TODO: Document
export const Url = (message?: string) => Match(CommonRegExp.url, message);
// TODO: Document
export const Precision = (digits: number, decimals?: number) => numberProp({ precision: [digits, decimals] });
// TODO: Document
export const Integer = () => Precision(0);
// TODO: Document
export const Float = () => Precision(10, 7);
// TODO: Document
export const Long = () => Precision(19, 0);
// TODO: Document
export const Currency = () => Precision(13, 2);

// For Auto schemas
/** @augments trv/schema/Ignore */
export function Ignore(): PropertyDecorator {
  return (target: any, property: string | symbol) => { };
}
