import { Any, castTo, Class, ClassInstance, DeepPartial } from '@travetto/runtime';

import { BindUtil } from '../bind-util.ts';
import { ClassConfig, ViewFieldsConfig } from '../service/types.ts';
import { MethodValidatorFn, ValidatorFn } from '../validate/types.ts';
import { SchemaRegistryIndex } from '../service/registry-index.ts';

/**
 * Register a class as a Schema
 *
 * @augments `@travetto/schema:Schema`
 */
export function Schema(cfg?: Partial<Pick<ClassConfig, 'subTypeName' | 'subTypeField' | 'baseType'>>) { // Auto is used during compilation
  return <T, U extends Class<T>>(target: U): U => {
    target.from ??= function <V>(this: Class<V>, data: DeepPartial<V>, view?: string): V {
      return BindUtil.bindSchema(this, data, { view });
    };
    SchemaRegistryIndex.getForRegister(target).register({ ...cfg });
    return target;
  };
}

/**
 * Add a custom validator, can be at the class level
 *
 * @param fn The validator function
 */
export const Validator = <T>(fn: ValidatorFn<T, string>) =>
  (target: Class<T>, _k?: string): void => {
    SchemaRegistryIndex.getForRegister(target).register({ validators: [castTo(fn)] });
  };

/**
 * Add a custom validator for a given method
 *
 * @param fn The validator function
 */
export function MethodValidator<T extends (...args: Any[]) => Any>(fn: MethodValidatorFn<Parameters<T>>) {
  return (target: ClassInstance, k: string, _prop: TypedPropertyDescriptor<T>): void => {
    SchemaRegistryIndex.getForRegister(target).registerMethod(k, { validators: [castTo(fn)] });
  };
}

/**
 * Register a specific view for a class
 * @param name The name of the view
 * @param fields The specific fields to add as part of a view
 */
export function View<T>(name: string, fields: ViewFieldsConfig<Partial<T>>) {
  return (target: Class<Partial<T>>): void => {
    SchemaRegistryIndex.getForRegister(target).register({ views: { [name]: fields } });
  };
}

/**
 * Register a class as a subtype, with a specific discriminator
 * @param name
 * @returns
 */
export function SubType<T>(name: string) {
  return (target: Class<Partial<T>>): void => {
    SchemaRegistryIndex.getForRegister(target).register({ subTypeName: name });
  };
}