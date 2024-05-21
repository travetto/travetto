import { ClassInstance } from '@travetto/base';

import { SchemaRegistry } from '../service/registry';
import { CommonRegExp } from '../validate/regexp';
import { ClassList, FieldConfig } from '../service/types';

type PropType<V> = (<T extends Partial<Record<K, V>>, K extends string>(t: T, k: K, idx?: number) => void) & {
  Param: (t: unknown, k: string, idx: number) => void;
};

function prop<V>(obj: Partial<FieldConfig>): PropType<V> {
  const fn = (t: ClassInstance, k: string, idx?: number): void => {
    if (idx !== undefined && typeof idx === 'number') {
      SchemaRegistry.registerPendingParamFacet(t.constructor, k, idx, obj);
    } else {
      SchemaRegistry.registerPendingFieldFacet(t.constructor, k, obj);
    }
  };
  fn.Param = fn;

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return fn as PropType<V>;
}

/**
 * Registering a field
 * @param type The type for the field
 * @param config The field configuration
 * @augments `@travetto/schema:Field`
 */
export function Field(type: ClassList, ...config: Partial<FieldConfig>[]) {
  return (f: ClassInstance, k: string, idx?: number): void => {
    if (idx !== undefined && typeof idx === 'number') {
      SchemaRegistry.registerPendingParamConfig(f.constructor, k, idx, type, Object.assign({}, ...config));
    } else {
      SchemaRegistry.registerPendingFieldConfig(f.constructor, k, type, Object.assign({}, ...config));
    }
  };
}

/**
 * Alias for the field
 * @param aliases List of all aliases for a field
 * @augments `@travetto/schema:Field`
 */
export function Alias(...aliases: string[]): PropType<unknown> { return prop({ aliases }); }
/**
 * Mark a field as writeonly
 * @param active This determines if this field is readonly or not.
 * @augments `@travetto/schema:Field`
 */
export function Writeonly(active = true): PropType<unknown> { return prop({ access: 'writeonly' }); }
/**
 * Mark a field as readonly
 * @param active This determines if this field is readonly or not.
 * @augments `@travetto/schema:Field`
 */
export function Readonly(active = true): PropType<unknown> { return prop({ access: 'readonly' }); }
/**
 * Mark a field as sensitive
 * @param active This determines if this field is sensitive or not.
 * @augments `@travetto/schema:Field`
 */
export function Secret(active = true): PropType<unknown> { return prop({ secret: active }); }
/**
 * Mark a field as required
 * @param active This determines if this field is required or not.
 * @param message The error message when a the constraint fails.
 * @augments `@travetto/schema:Field`
 */
export function Required(active = true, message?: string): PropType<unknown> { return prop({ required: { active, message } }); }
/**
 * Define a field as a set of enumerated values
 * @param values The list of values allowed for the enumeration
 * @param message The error message to show when the constraint fails
 * @augments `@travetto/schema:Field`
 */
export function Enum(values: string[], message?: string): PropType<string | number> {
  message = message || `{path} is only allowed to be "${values.join('" or "')}"`;
  return prop({ enum: { values, message } });
}
/**
 * Mark the field as indicating it's storing textual data
 * @augments `@travetto/schema:Field`
 */
export function Text(): PropType<string | string[]> { return prop({ specifiers: ['text'] }); }
/**
 * Mark the field to indicate it's for long form text
 * @augments `@travetto/schema:Field`
 */
export function LongText(): PropType<string | string[]> { return prop({ specifiers: ['text', 'long'] }); }

/**
 * Require the field to match a specific RegExp
 * @param re The regular expression to match against
 * @param message The message to show when the constraint fails
 * @augments `@travetto/schema:Field`
 */
export function Match(re: RegExp, message?: string): PropType<string | string[]> { return prop({ match: { re, message } }); }

/**
 * The minimum length for the string or array
 * @param n The minimum length
 * @param message The message to show when the constraint fails
 * @augments `@travetto/schema:Field`
 */
export function MinLength(n: number, message?: string): PropType<string | unknown[]> {
  return prop({ minlength: { n, message }, ...(n === 0 ? { required: { active: false } } : {}) });
}

/**
 * The maximum length for the string or array
 * @param n The maximum length
 * @param message The message to show when the constraint fails
 * @augments `@travetto/schema:Field`
 */
export function MaxLength(n: number, message?: string): PropType<string | unknown[]> { return prop({ maxlength: { n, message } }); }

/**
 * The minimum value
 * @param n The minimum value
 * @param message The message to show when the constraint fails
 * @augments `@travetto/schema:Field`
 */
export function Min<T extends number | Date>(n: T, message?: string): PropType<Date | number> {
  return prop({ min: { n, message } });
}

/**
 * The maximum value
 * @param n The maximum value
 * @param message The message to show when the constraint fails
 * @augments `@travetto/schema:Field`
 */
export function Max<T extends number | Date>(n: T, message?: string): PropType<Date | number> {
  return prop({ max: { n, message } });
}

/**
 * Mark a field as an email
 * @param message The message to show when the constraint fails
 * @augments `@travetto/schema:Field`
 */
export function Email(message?: string): PropType<string | string[]> { return Match(CommonRegExp.email, message); }

/**
 * Mark a field as an telephone number
 * @param message The message to show when the constraint fails
 * @augments `@travetto/schema:Field`
 */
export function Telephone(message?: string): PropType<string | string[]> { return Match(CommonRegExp.telephone, message); }

/**
 * Mark a field as a url
 * @param message The message to show when the constraint fails
 * @augments `@travetto/schema:Field`
 */
export function Url(message?: string): PropType<string | string[]> { return Match(CommonRegExp.url, message); }

/**
 * Determine the numeric precision of the value
 * @param digits The number of digits a number should have
 * @param decimals The number of decimal digits to support
 * @augments `@travetto/schema:Field`
 */
export function Precision(digits: number, decimals?: number): PropType<number> { return prop({ precision: [digits, decimals] }); }

/**
 * Mark a number as an integer
 * @augments `@travetto/schema:Field`
 */
export function Integer(): PropType<number> { return Precision(0); }

/**
 * Mark a number as a float
 * @augments `@travetto/schema:Field`
 */
export function Float(): PropType<number> { return Precision(10, 7); }

/**
 * Mark a number as a long value
 * @augments `@travetto/schema:Field`
 */
export function Long(): PropType<number> { return Precision(19, 0); }

/**
 * Mark a number as a currency
 * @augments `@travetto/schema:Field`
 */
export function Currency(): PropType<number> { return Precision(13, 2); }

/**
 * Mark a field as ignored
 *
 * @augments `@travetto/schema:Ignore`
 */
export function Ignore(): PropertyDecorator {
  return (target: Object, property: string | symbol) => { };
}

/**
 * Specifier for the field
 * @param specifiers The specifiers for a field
 * @augments `@travetto/schema:Field`
 */
export function Specifier(...specifiers: string[]): PropType<unknown> { return prop({ specifiers }); }

/**
 * Sets the subtype field via a property decorator
 * @augments `@travetto/schema:Field`
 */
export function SubTypeField(): ((t: ClassInstance, k: string) => void) {
  return (t: ClassInstance, k: string): void => {
    SchemaRegistry.register(t.constructor, { subTypeField: k });
  };
}