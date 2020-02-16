import { Class } from '@travetto/registry';
import { SchemaRegistry } from '../service/registry';
import { ViewFieldsConfig } from '../service/types';
import { ValidatorFn } from '../validate/types';

/** @alias trv/schema/Schema */
export function Schema(auto: boolean = true): ClassDecorator { // Auto is used during compilation
  return (<T>(target: Class<T>): Class<T> => {
    SchemaRegistry.getOrCreatePending(target);
    return target;
  }) as any;
}

export function Validator<T>(fn: ValidatorFn<T, string>) {
  return (target: Class<T>) => {
    SchemaRegistry.getOrCreatePending(target).validators!.push(fn);
  };
}

export function View<T>(name: string, fields: ViewFieldsConfig<Partial<T>>) {
  return (target: Class<Partial<T>>) => {
    SchemaRegistry.registerPendingView(target, name, fields);
  };
}