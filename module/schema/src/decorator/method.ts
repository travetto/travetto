import { type Any, castTo, type ClassInstance, getClass } from '@travetto/runtime';

import type { SchemaMethodConfig } from '../service/types.ts';
import { SchemaRegistryIndex } from '../service/registry-index.ts';
import type { MethodValidatorFn } from '../validate/types.ts';

type MethodDecorator = (instance: ClassInstance, property: string, descriptor: PropertyDescriptor) => PropertyDescriptor | void;

/**
 * Registering a method
 * @param config The method configuration
 * @augments `@travetto/schema:Method`
 * @kind decorator
 */
export function Method(...config: Partial<SchemaMethodConfig>[]) {
  return (instanceOrCls: ClassInstance, property: string): void => {
    SchemaRegistryIndex.getForRegister(getClass(instanceOrCls)).registerMethod(property, ...config);
  };
}

/**
 * Add a custom validator for a given method
 *
 * @param fn The validator function
 * @augments `@travetto/schema:Method`
 * @kind decorator
 */
export function MethodValidator<T extends (...args: Any[]) => Any>(fn: MethodValidatorFn<Parameters<T>>): MethodDecorator {
  return Method({ validators: [castTo(fn)] });
}
