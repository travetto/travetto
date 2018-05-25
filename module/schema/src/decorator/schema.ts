import { Field } from './field';
import { SchemaRegistry, ValidatorFn } from '../service';
import { Class } from '@travetto/registry';

export function Schema(auto: boolean = true): ClassDecorator {
  return (target: Class<any>) => {
    SchemaRegistry.getOrCreatePending(target);
  };
}

export function Validator<T>(fn: ValidatorFn<T, string>) {
  return (target: Class<T>) => {
    SchemaRegistry.getOrCreatePending(target).validators!.push(fn);
  };
}