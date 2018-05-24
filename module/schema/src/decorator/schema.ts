import { Field } from './field';
import { SchemaRegistry, ValidatorFn } from '../service';

export function Schema(auto: boolean = true): ClassDecorator {
  return (target: any) => {
    SchemaRegistry.register(target, {});
  };
}

export const Validator = (fn: ValidatorFn) => {
  return (target: any, p?: any, desc?: any) => {
    if (p) {
      return SchemaRegistry.getOrCreatePendingMethod(target.constructor, desc.value).validators!.push(fn);
    } else {
      return SchemaRegistry.getOrCreatePending(target).validators!.push(fn);
    }
  };
}