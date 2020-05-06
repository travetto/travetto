import { Class } from '@travetto/registry';
import { SchemaRegistry } from '../service/registry';
import { ViewFieldsConfig } from '../service/types';
import { ValidatorFn } from '../validate/types';

/**
 * TODO: Document
 *
 * @augments trv/schema/Schema
 */
export function Schema(): ClassDecorator { // Auto is used during compilation
  return (<T>(target: Class<T>): Class<T> => {
    SchemaRegistry.getOrCreatePending(target);
    return target;
  }) as any;
}

// TODO: Document
export function Validator<T>(fn: ValidatorFn<T, string>) {
  return (target: Class<T>) => {
    SchemaRegistry.getOrCreatePending(target).validators!.push(fn);
  };
}

// TODO: Document
export function View<T>(name: string, fields: ViewFieldsConfig<Partial<T>>) {
  return (target: Class<Partial<T>>) => {
    SchemaRegistry.registerPendingView(target, name, fields);
  };
}