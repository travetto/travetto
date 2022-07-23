import { Class } from '@travetto/base';

import { SchemaRegistry } from '../service/registry';
import { ViewFieldsConfig } from '../service/types';
import { ValidatorFn } from '../validate/types';

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
  return (target: Class<T>): void => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    SchemaRegistry.getOrCreatePending(target).validators!.push(fn as ValidatorFn<unknown, unknown>);
  };
}

/**
 * Register a specific view for a class
 * @param name The name of the view
 * @param fields The specific fields to add as part of a view
 */
export function View<T>(name: string, fields: ViewFieldsConfig<Partial<T>>) {
  return (target: Class<Partial<T>>): void => {
    SchemaRegistry.registerPendingView(target, name, fields);
  };
}

/**
 * Register a class as a subtype, with a specific discriminator
 * @param name
 * @returns
 */
export function SubType<T>(name: string) {
  return (target: Class<Partial<T>>): void => {
    SchemaRegistry.registerSubTypes(target, name);
  };
}