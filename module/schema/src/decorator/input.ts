import { Any, Class, ClassInstance, getClass } from '@travetto/runtime';

import { CommonRegExp } from '../validate/regexp.ts';
import { CONSTRUCTOR_PROPERTY, SchemaInputConfig } from '../service/types.ts';
import { SchemaRegistryIndex } from '../service/registry-index.ts';

type PropType<V> = (<T extends Partial<Record<K, V | Function>>, K extends string>(t: T, property: K, idx?: TypedPropertyDescriptor<Any> | number) => void);

function input<V>(...configs: Partial<SchemaInputConfig>[]): PropType<V> {
  return (instanceOrCls: ClassInstance | Class, property: string | symbol, idx?: number | TypedPropertyDescriptor<Any>): void => {
    const adapter = SchemaRegistryIndex.getForRegister(getClass(instanceOrCls));
    const propertyKey = property ?? CONSTRUCTOR_PROPERTY;
    if (typeof idx === 'number') {
      adapter.registerParameter(propertyKey, idx, ...configs);
    } else {
      adapter.registerField(propertyKey, ...configs);
    }
  };
}

/**
 * Registering an input
 * @param type The type for the input
 * @param configs The input configuration
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Input(type: Pick<SchemaInputConfig, 'type' | 'array'>, ...configs: Partial<SchemaInputConfig>[]): PropType<unknown> {
  return input(type, ...configs);
}

/**
 * Alias for the input
 * @param aliases List of all aliases for a field
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Alias(...aliases: string[]): PropType<unknown> { return input({ aliases }); }

/**
 * Mark an input as required
 * @param active This determines if this field is required or not.
 * @param message The error message when a the constraint fails.
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Required(active = true, message?: string): PropType<unknown> { return input({ required: { active, message } }); }

/**
 * Define an input as a set of enumerated values
 * @param values The list of values allowed for the enumeration
 * @param message The error message to show when the constraint fails
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Enum(values: string[], message?: string): PropType<string | number> {
  message = message || `{path} is only allowed to be "${values.join('" or "')}"`;
  return input({ enum: { values, message } });
}

/**
 * Mark the input as indicating it's storing textual data
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Text(): PropType<string | string[]> { return input({ specifiers: ['text'] }); }

/**
 * Mark the input to indicate it's for long form text
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function LongText(): PropType<string | string[]> { return input({ specifiers: ['text', 'long'] }); }

/**
 * Require the input to match a specific RegExp
 * @param re The regular expression to match against
 * @param message The message to show when the constraint fails
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Match(re: RegExp, message?: string): PropType<string | string[]> { return input({ match: { re, message } }); }

/**
 * The minimum length for the string or array
 * @param n The minimum length
 * @param message The message to show when the constraint fails
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function MinLength(n: number, message?: string): PropType<string | unknown[]> {
  return input({ minlength: { n, message }, ...(n === 0 ? { required: { active: false } } : {}) });
}

/**
 * The maximum length for the string or array
 * @param n The maximum length
 * @param message The message to show when the constraint fails
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function MaxLength(n: number, message?: string): PropType<string | unknown[]> { return input({ maxlength: { n, message } }); }

/**
 * The minimum value
 * @param n The minimum value
 * @param message The message to show when the constraint fails
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Min<T extends number | Date>(n: T, message?: string): PropType<Date | number> {
  return input({ min: { n, message } });
}

/**
 * The maximum value
 * @param n The maximum value
 * @param message The message to show when the constraint fails
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Max<T extends number | Date>(n: T, message?: string): PropType<Date | number> {
  return input({ max: { n, message } });
}

/**
 * Mark an input as an email
 * @param message The message to show when the constraint fails
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Email(message?: string): PropType<string | string[]> { return Match(CommonRegExp.email, message); }

/**
 * Mark an input as an telephone number
 * @param message The message to show when the constraint fails
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Telephone(message?: string): PropType<string | string[]> { return Match(CommonRegExp.telephone, message); }

/**
 * Mark an input as a url
 * @param message The message to show when the constraint fails
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Url(message?: string): PropType<string | string[]> { return Match(CommonRegExp.url, message); }

/**
 * Determine the numeric precision of the value
 * @param digits The number of digits a number should have
 * @param decimals The number of decimal digits to support
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Precision(digits: number, decimals?: number): PropType<number> { return input({ precision: [digits, decimals] }); }

/**
 * Mark a number as an integer
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Integer(): PropType<number> { return Precision(0); }

/**
 * Mark a number as a float
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Float(): PropType<number> { return Precision(10, 7); }

/**
 * Mark a number as a long value
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Long(): PropType<number> { return Precision(19, 0); }

/**
 * Mark a number as a currency
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Currency(): PropType<number> { return Precision(13, 2); }

/**
 * Specifier for the input
 * @param specifiers The specifiers for an input
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Specifier(...specifiers: string[]): PropType<unknown> { return input({ specifiers }); }

/**
 * Sets the discriminator field via a property decorator
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function DiscriminatorField(): ((t: ClassInstance, property: string) => void) {
  return (instance: ClassInstance, property: string): void => {
    SchemaRegistryIndex.getForRegister(getClass(instance)).register({
      discriminatedBase: true,
      discriminatedField: property
    });
  };
}