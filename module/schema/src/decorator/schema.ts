import { SchemaRegistry, ValidatorFn } from '../service';
import { Class } from '@travetto/registry';

export function Schema(auto: boolean = true): ClassDecorator {
  return <T>(target: Class<T>): Class<T> => {
    const res: Class<T> = target as any;
    SchemaRegistry.getOrCreatePending(target);
    return res;
  };
}

export function Validator<T>(fn: ValidatorFn<T, string>) {
  return (target: Class<T>) => {
    SchemaRegistry.getOrCreatePending(target).validators!.push(fn);
  };
}