/// <reference path="../typings.d.ts" />

import { Class } from '@travetto/registry';
import { SchemaRegistry } from '../registry';
import { ValidatorFn } from '../types';

export function Schema(auto: boolean = true): ClassDecorator {
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