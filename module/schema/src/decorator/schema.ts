import { type Class, castTo, type DeepPartial } from '@travetto/runtime';

import { BindUtil } from '../bind-util.ts';
import { SchemaRegistryIndex } from '../service/registry-index.ts';
import type { SchemaClassConfig } from '../service/types.ts';
import type { ValidatorFn } from '../validate/types.ts';

/**
 * Provides all the valid string type fields from a given type T
 */
type ValidStringField<T> = { [K in Extract<keyof T, string>]: T[K] extends string ? K : never }[Extract<keyof T, string>];

/**
 * Register a class as a Schema
 *
 * @augments `@travetto/schema:Schema`
 * @kind decorator
 */
export function Schema(config?: Partial<Pick<SchemaClassConfig, 'validators' | 'methods'>>) {
  return <T, U extends Class<T>>(cls: U): void => {
    cls.from ??= function <V>(this: Class<V>, data: DeepPartial<V>): V {
      return BindUtil.bindSchema(this, data) as V;
    };
    SchemaRegistryIndex.getForRegister(cls).registerClass(config);
  };
}

/**
 * Add a custom validator, can be at the class level
 *
 * @param fn The validator function
 * @kind decorator
 */
export const Validator =
  <T>(fn: ValidatorFn<T, string>) =>
  (cls: Class<T>): void => {
    SchemaRegistryIndex.getForRegister(cls).register({ validators: [castTo(fn)] });
  };

/**
 * Register a class as a discriminated class, by a specific type
 * @param type The type to use for discrimination
 * @kind decorator
 */
export function SubType<T>(type?: string) {
  return (cls: Class<Partial<T>>): void => {
    SchemaRegistryIndex.getForRegister(cls).register({ discriminatedType: type });
  };
}

/**
 * Register a class as a discriminated class
 * @param field The field to use for discrimination
 * @kind decorator
 */
export function Discriminated<T>(field: ValidStringField<T>) {
  return (cls: Class<Partial<T>>): void => {
    SchemaRegistryIndex.getForRegister(cls).register({ discriminatedField: field, discriminatedBase: true });
  };
}
