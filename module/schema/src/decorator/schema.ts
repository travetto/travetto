import { Field } from './field';
import { SchemaRegistry, ValidatorFn } from '../service';
import { Class } from '@travetto/registry';
import { BindUtil } from '../util';

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
};

export interface ClassWithSchema<T> {
  new(...args: any[]): T;
  from(data: DeepPartial<T & { [key: string]: any }>, view?: string): T;
}

export function Schema(auto: boolean = true): ClassDecorator {
  return <T>(target: Class<T>): ClassWithSchema<T> => {
    const res: ClassWithSchema<T> = target as any;
    SchemaRegistry.getOrCreatePending(target);

    if (!res.from) {
      res.from = function (data: any, view: any) {
        // tslint:disable-next-line:no-invalid-this
        return BindUtil.bindSchema(this as Class<T>, new this(), data, view);
      };
    }

    return res;
  };
}

export function Validator<T>(fn: ValidatorFn<T, string>) {
  return (target: Class<T>) => {
    SchemaRegistry.getOrCreatePending(target).validators!.push(fn);
  };
}