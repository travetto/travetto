import { Any, castTo, ClassInstance } from '@travetto/runtime';

import { SchemaMethodConfig } from '../service/types';
import { SchemaRegistryIndex } from '../service/registry-index';
import { MethodValidatorFn } from '../validate/types';

/**
 * Registering a method
 * @param config The method configuration
 * @augments `@travetto/schema:Method`
 */
export function Method(...config: Partial<SchemaMethodConfig>[]) {
  return (instance: ClassInstance, property: string | symbol): void => {
    SchemaRegistryIndex.getForRegister(instance.constructor).registerMethod(property, ...config);
  };
}

/**
 * Add a custom validator for a given method
 *
 * @param fn The validator function
 */
export function MethodValidator<T extends (...args: Any[]) => Any>(fn: MethodValidatorFn<Parameters<T>>) {
  return (instance: ClassInstance, property: string, _prop: TypedPropertyDescriptor<T>): void => {
    SchemaRegistryIndex.getForRegister(instance.constructor).registerMethod(property, { validators: [castTo(fn)] });
  };
}
