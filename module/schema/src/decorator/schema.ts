import { Field } from './field';
import { SchemaRegistry, ValidatorFn } from '../service';
import { Class } from '@travetto/registry';
import { SchemaBound, DeepPartial } from '../model/bound';

export interface ClassWithSchema<T> {
  new(...args: any[]): T;
  from(data: DeepPartial<T & { [key: string]: any }>, view?: string): T;
}

export function Schema(auto: boolean = true) {
  return <T>(target: Class<T>): ClassWithSchema<T> => {
    const res: ClassWithSchema<T> = target as any;
    SchemaRegistry.getOrCreatePending(target);
    if (!res.from) {
      res.from = SchemaBound.from.bind(null, target); // Provide static from on all Schema classes, even though typescript can't see this
    }
    return res;
  };
}

export function Validator<T>(fn: ValidatorFn<T, string>) {
  return (target: Class<T>) => {
    SchemaRegistry.getOrCreatePending(target).validators!.push(fn);
  };
}