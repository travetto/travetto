import { Class, ClassInstance } from '@travetto/base';

import { SchemaRegistry } from '../service/registry';
import { ViewFieldsConfig } from '../service/types';
import { ValidatorFn } from '../validate/types';
import { SchemaValidator } from '../validate/validator';

/**
 * Register a class as a Schema
 *
 * @augments `@trv:schema/Schema`
 */
export function Schema() { // Auto is used during compilation
  return <T, U extends Class<T>>(target: U): U => {
    SchemaRegistry.getOrCreatePending(target);
    return target;
  };
}

/**
 * Add a custom validator, can be at the class level
 *
 * @param fn The validator function
 */
export function Validator<T>(fn: ValidatorFn<T, string>) {
  return (target: Class<T>) => {
    SchemaRegistry.getOrCreatePending(target).validators!.push(fn as ValidatorFn<unknown, unknown>);
  };
}

/**
 * Register a specific view for a class
 * @param name The name of the view
 * @param fields The specific fields to add as part of a view
 */
export function View<T>(name: string, fields: ViewFieldsConfig<Partial<T>>) {
  return (target: Class<Partial<T>>) => {
    SchemaRegistry.registerPendingView(target, name, fields);
  };
}

/**
 * Validates the method is called with the appropriate parameters
 *
 * @augments `@trv:schema/Validate`
 */
export function Validate<T>() {
  return (target: T, prop: string, desc: TypedPropertyDescriptor<(...args: any[]) => any>) => {
    const og = desc.value;
    desc.value = function (this: unknown, ...args: unknown[]) {
      SchemaValidator.validateMethod((target as unknown as ClassInstance).constructor, prop, args);
      return og!.call(this, ...args);
    };
    return desc;
  };
}