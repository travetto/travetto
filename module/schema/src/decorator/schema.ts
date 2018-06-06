import { Class } from '@travetto/registry';
import { SchemaRegistry, ValidatorFn } from '../service';
import { BindUtil } from '../util';

export function Schema(auto: boolean = true): ClassDecorator {
  return <T>(target: Class<T>): Class<T> => {
    const res: Class<T> = target as any;
    SchemaRegistry.getOrCreatePending(target);
    if (!res.from) {
      res.from = function (data: any, view: any) {
        // tslint:disable-next-line:no-invalid-this
        return BindUtil.bindSchema(this, new this(), data, view);
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