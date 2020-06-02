import { Class } from '@travetto/registry';
import { SchemaRegistry } from '../service/registry';
import { ViewFieldsConfig } from '../service/types';
import { ValidatorFn } from '../validate/types';

/**
 * Register a class as a Schema
 *
 * @augments `@trv:schema/Schema`
 */
export function Schema(): ClassDecorator { // Auto is used during compilation
  return (<T>(target: Class<T>): Class<T> => {
    SchemaRegistry.getOrCreatePending(target);
    return target;
  }) as ClassDecorator;
}

/**
 * Add a custom validator, can be at the class level
 *
 * @param fn The validator function
 */
export function Validator<T>(fn: ValidatorFn<T, string>) {
  return (target: Class<T>) => {
    SchemaRegistry.getOrCreatePending(target).validators!.push(fn);
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