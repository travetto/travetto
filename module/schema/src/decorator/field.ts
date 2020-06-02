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

/**
 * Registering a field
 * @param type The type for the field
 * @param config The field configuration
 */
export function Field(type: ClassList, config?: Partial<FieldConfig>) {
  return (f: any, p: string) => {
    SchemaRegistry.registerPendingFieldConfig(f.constructor, p, type);
    if (config) {
      SchemaRegistry.registerPendingFieldFacet(f.constructor, p, config);
    }
  };
}

/**
 * Alias for the field
 * @param aliases List of all aliases for a field
 */
export const Alias = (...aliases: string[]) => prop({ aliases });
/**
 * Mark a field as required
 * @param active This determines if this field is required or not.
 * @param message The error message when a the constraint fails.
 */
export const Required = (active = true, message?: string) => prop({ required: { active, message } });
/**
 * Define a field as a set of enumerated values
 * @param vals The list of values allowed for the enumeration
 * @param message The error message to show when the constraint fails
 */
export const Enum = ((vals: string[] | any, message?: string) => {
  const values = enumKeys(vals);
  message = message || `{path} is only allowed to be "${values.join('" or "')}"`;
  return stringNumberProp({ enum: { values, message } });
});

/**
 * Should the field be trimmed on storage
 */
export const Trimmed = () => stringArrStringProp({ trim: true });
/**
 * Mark the field as indicating it's storing textual data
 */
export const Text = () => stringArrStringProp({ specifier: 'text' });
/**
 * Mark the field to indicate it's for long form text
 */
export const LongText = () => stringArrStringProp({ specifier: 'text-long' });

/**
 * Require the field to match a specific RegExp
 * @param re The regular expression to match against
 * @param message The message to show when the constraint fails
 */
export const Match = (re: RegExp, message?: string) => stringArrStringProp({ match: { re, message } });

/**
 * The minimum length for the string or array
 * @param n The minimum length
 * @param message The message to show when the constraint fails
 */
export const MinLength = (n: number, message?: string) => stringArrProp({ minlength: { n, message }, ...(n === 0 ? { required: { active: false } } : {}) });

/**
 * The maximum length for the string or array
 * @param n The maximum length
 * @param message The message to show when the constraint fails
 */
export const MaxLength = (n: number, message?: string) => stringArrProp({ maxlength: { n, message } });

/**
 * The minimum value
 * @param n The minimum value
 * @param message The message to show when the constraint fails
 */
export const Min = <T extends number | Date>(n: T, message?: string) => dateNumberProp({ min: { n, message } });

/**
 * The maximum value
 * @param n The maximum value
 * @param message The message to show when the constraint fails
 */
export const Max = <T extends number | Date>(n: T, message?: string) => dateNumberProp({ max: { n, message } });

/**
 * Mark a field as an email
 * @param message The message to show when the constraint fails
 */
export const Email = (message?: string) => Match(CommonRegExp.email, message);

/**
 * Mark a field as an telephone number
 * @param message The message to show when the constraint fails
 */
export const Telephone = (message?: string) => Match(CommonRegExp.telephone, message);

/**
 * Mark a field as a url
 * @param message The message to show when the constraint fails
 */
export const Url = (message?: string) => Match(CommonRegExp.url, message);

/**
 * Determine the numeric precision of the value
 * @param digits The number of digits a number should have
 * @param decimals The number of decimal digits to support
 */
export const Precision = (digits: number, decimals?: number) => numberProp({ precision: [digits, decimals] });

/**
 * Mark a number as an integer
 */
export const Integer = () => Precision(0);

/**
 * Mark a number as a float
 */
export const Float = () => Precision(10, 7);

/**
 * Mark a number as a long value
 */
export const Long = () => Precision(19, 0);

/**
 * Mark a number as a currency
 */
export const Currency = () => Precision(13, 2);

/**
 * Mark a field as ignored
 *
 * @augments `@trv:schema/Ignore`
 */
export function Ignore(): PropertyDecorator {
  return (target: any, property: string | symbol) => { };
}
