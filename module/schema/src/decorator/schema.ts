import { castTo, Class, DeepPartial } from '@travetto/runtime';

import { BindUtil } from '../bind-util.ts';
import { SchemaClassConfig, ViewFieldsConfig } from '../service/types.ts';
import { ValidatorFn } from '../validate/types.ts';
import { SchemaRegistryIndex } from '../service/registry-index.ts';

/**
 * Provides all the valid string type fields from a given type T
 */
type ValidStringField<T> = { [K in Extract<keyof T, string>]: T[K] extends string ? K : never }[Extract<keyof T, string>];

const classToDiscriminatedType = (cls: Class): string => cls.name
  .replace(/([A-Z])([A-Z][a-z])/g, (all, l, r) => `${l}_${r.toLowerCase()}`)
  .replace(/([a-z]|\b)([A-Z])/g, (all, l, r) => l ? `${l}_${r.toLowerCase()}` : r.toLowerCase())
  .toLowerCase();

/**
 * Register a class as a Schema
 *
 * @augments `@travetto/schema:Schema`
 */
export function Schema(cfg?: Partial<Pick<SchemaClassConfig, 'validators' | 'methods'>>) {
  return <T, U extends Class<T>>(cls: U): void => {
    cls.from ??= function <V>(this: Class<V>, data: DeepPartial<V>, view?: string): V {
      return BindUtil.bindSchema(this, data, { view });
    };
    SchemaRegistryIndex.getForRegister(cls).registerClass(cfg);
  };
}

/**
 * Add a custom validator, can be at the class level
 *
 * @param fn The validator function
 */
export const Validator = <T>(fn: ValidatorFn<T, string>) =>
  (cls: Class<T>): void => {
    SchemaRegistryIndex.getForRegister(cls).register({ validators: [castTo(fn)] });
  };

/**
 * Register a specific view for a class
 * @param name The name of the view
 * @param fields The specific fields to add as part of a view
 */
export function View<T>(name: string, fields: ViewFieldsConfig<Partial<T>>) {
  return (cls: Class<Partial<T>>): void => {
    SchemaRegistryIndex.getForRegister(cls).register({ views: { [name]: fields } });
  };
}

/**
 * Register a class as a discriminated class, by a specific type
 * @param type
 */
export function SubType<T>(type?: string) {
  return (cls: Class<Partial<T>>): void => {
    SchemaRegistryIndex.getForRegister(cls).register({
      discriminatedType: type ?? classToDiscriminatedType(cls),
      classType: 'discriminated'
    });
  };
}

/**
 * Register a class as a discriminated class
 * @param type
 */
export function Discriminated<T>(field: ValidStringField<T>) {
  return (cls: Class<Partial<T>>): void => {
    SchemaRegistryIndex.getForRegister(cls).register({ discriminatedField: field, classType: 'discriminated-base' });
  };
}