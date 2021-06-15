import { ClassInstance } from '@travetto/base';

import { SchemaRegistry } from '../service/registry';
import { CommonRegExp } from '../validate/regexp';
import { ClassList, FieldConfig } from '../service/types';

function prop(obj: Partial<FieldConfig>) {
  return (t: ClassInstance, k: string, idx?: number | PropertyDescriptor) => {
    if (idx !== undefined && typeof idx === 'number') {
      SchemaRegistry.registerPendingParamFacet(t.constructor, k, idx, obj);
    } else {
      SchemaRegistry.registerPendingFieldFacet(t.constructor, k, obj);
    }
  };
}

const stringArrProp = prop as
  (obj: Partial<FieldConfig>) => <T extends Partial<Record<K, string | unknown[]>>, K extends string>(t: T, k: K, idx?: number | PropertyDescriptor) => void;

const stringArrStringProp = prop as
  (obj: Partial<FieldConfig>) => <T extends Partial<Record<K, string | string[]>>, K extends string>(t: T, k: K, idx?: number | PropertyDescriptor) => void;

const numberProp = prop as
  (obj: Partial<FieldConfig>) => <T extends Partial<Record<K, number>>, K extends string>(t: T, k: K, idx?: number | PropertyDescriptor) => void;

const stringNumberProp = prop as
  (obj: Partial<FieldConfig>) => <T extends Partial<Record<K, string | number>>, K extends string>(t: T, k: K, idx?: number | PropertyDescriptor) => void;

const dateNumberProp = prop as
  (obj: Partial<FieldConfig>) => <T extends Partial<Record<K, Date | number>>, K extends string>(t: T, k: K, idx?: number | PropertyDescriptor) => void;

/**
 * Registering a field
 * @param type The type for the field
 * @param config The field configuration
 * @augments `@trv:schema/Field`
 */
export function Field(type: ClassList, config?: Partial<FieldConfig>) {
  return (f: ClassInstance, k: string, idx?: number | PropertyDescriptor) => {
    if (idx !== undefined && typeof idx === 'number') {
      SchemaRegistry.registerPendingParamConfig(f.constructor, k, idx, type, config);
    } else {
      SchemaRegistry.registerPendingFieldConfig(f.constructor, k, type, config);
    }
  };
}

/**
 * Alias for the field
 * @param aliases List of all aliases for a field
 * @augments `@trv:schema/Field`
 */
export function Alias(...aliases: string[]) { return prop({ aliases }); }
/**
 * Mark a field as writeonly
 * @param active This determines if this field is readonly or not.
 * @augments `@trv:schema/Field`
 */
export function Writeonly(active = true) { return prop({ access: 'writeonly' }); }
/**
 * Mark a field as readonly
 * @param active This determines if this field is readonly or not.
 * @augments `@trv:schema/Field`
 */
export function Readonly(active = true) { return prop({ access: 'readonly' }); }
/**
 * Mark a field as required
 * @param active This determines if this field is required or not.
 * @param message The error message when a the constraint fails.
 * @augments `@trv:schema/Field`
 */
export function Required(active = true, message?: string) { return prop({ required: { active, message } }); }
/**
 * Define a field as a set of enumerated values
 * @param vals The list of values allowed for the enumeration
 * @param message The error message to show when the constraint fails
 * @augments `@trv:schema/Field`
 */
export function Enum(values: string[], message?: string) {
  message = message || `{path} is only allowed to be "${values.join('" or "')}"`;
  return stringNumberProp({ enum: { values, message } });
}
/**
 * Mark the field as indicating it's storing textual data
 * @augments `@trv:schema/Field`
 */
export function Text() { return stringArrStringProp({ specifier: 'text' }); }
/**
 * Mark the field to indicate it's for long form text
 * @augments `@trv:schema/Field`
 */
export function LongText() { return stringArrStringProp({ specifier: 'text-long' }); }

/**
 * Require the field to match a specific RegExp
 * @param re The regular expression to match against
 * @param message The message to show when the constraint fails
 * @augments `@trv:schema/Field`
 */
export function Match(re: RegExp, message?: string) { return stringArrStringProp({ match: { re, message } }); }

/**
 * The minimum length for the string or array
 * @param n The minimum length
 * @param message The message to show when the constraint fails
 * @augments `@trv:schema/Field`
 */
export function MinLength(n: number, message?: string) { return stringArrProp({ minlength: { n, message }, ...(n === 0 ? { required: { active: false } } : {}) }); }

/**
 * The maximum length for the string or array
 * @param n The maximum length
 * @param message The message to show when the constraint fails
 * @augments `@trv:schema/Field`
 */
export function MaxLength(n: number, message?: string) { return stringArrProp({ maxlength: { n, message } }); }

/**
 * The minimum value
 * @param n The minimum value
 * @param message The message to show when the constraint fails
 * @augments `@trv:schema/Field`
 */
export function Min<T extends number | Date>(n: T, message?: string) { return dateNumberProp({ min: { n, message } }); }

/**
 * The maximum value
 * @param n The maximum value
 * @param message The message to show when the constraint fails
 * @augments `@trv:schema/Field`
 */
export function Max<T extends number | Date>(n: T, message?: string) { return dateNumberProp({ max: { n, message } }); }

/**
 * Mark a field as an email
 * @param message The message to show when the constraint fails
 * @augments `@trv:schema/Field`
 */
export function Email(message?: string) { return Match(CommonRegExp.email, message); }

/**
 * Mark a field as an telephone number
 * @param message The message to show when the constraint fails
 * @augments `@trv:schema/Field`
 */
export function Telephone(message?: string) { return Match(CommonRegExp.telephone, message); }

/**
 * Mark a field as a url
 * @param message The message to show when the constraint fails
 * @augments `@trv:schema/Field`
 */
export function Url(message?: string) { return Match(CommonRegExp.url, message); }

/**
 * Determine the numeric precision of the value
 * @param digits The number of digits a number should have
 * @param decimals The number of decimal digits to support
 * @augments `@trv:schema/Field`
 */
export function Precision(digits: number, decimals?: number) { return numberProp({ precision: [digits, decimals] }); }

/**
 * Mark a number as an integer
 * @augments `@trv:schema/Field`
 */
export function Integer() { return Precision(0); }

/**
 * Mark a number as a float
 * @augments `@trv:schema/Field`
 */
export function Float() { return Precision(10, 7); }

/**
 * Mark a number as a long value
 * @augments `@trv:schema/Field`
 */
export function Long() { return Precision(19, 0); }

/**
 * Mark a number as a currency
 * @augments `@trv:schema/Field`
 */
export function Currency() { return Precision(13, 2); }

/**
 * Mark a field as ignored
 *
 * @augments `@trv:schema/Ignore`
 */
export function Ignore(): PropertyDecorator {
  return (target: Object, property: string | symbol) => { };
}
