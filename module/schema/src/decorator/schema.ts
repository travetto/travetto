import { Class } from '@travetto/runtime';

import { BindUtil } from '../bind-util';
import { SchemaRegistry } from '../service/registry';
import { ClassConfig, ViewFieldsConfig } from '../service/types';
import { DeepPartial } from '../types';
import { ValidatorFn } from '../validate/types';

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
    SchemaRegistry.register(target, cfg);
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
    SchemaRegistry.register(target, { subTypeName: name });
  };
}