import { Class } from '@travetto/registry';
import { SchemaRegistry } from '../service';
import { ValidatorFn } from '../types';

export interface ClassWithSchema<T> extends Class<T> {
  from<U>(this: Class<U>, data: U, view?: string): U;
}

export function Schema(auto: boolean = true): ClassDecorator {
  return <T>(target: Class<T>): Class<T> => {
    const res: ClassWithSchema<T> = target as any;
    SchemaRegistry.getOrCreatePending(target);
    return res;
  };
}

export function Validator<T>(fn: ValidatorFn<T, string>) {
  return (target: Class<T>) => {
    SchemaRegistry.getOrCreatePending(target).validators!.push(fn);
  };
}