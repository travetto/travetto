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
  return (instanceOrCls: ClassInstance, property: string | symbol): void => {
    const adapter = ('Ⲑid' in instanceOrCls) ?
      SchemaRegistryIndex.getForRegister(instanceOrCls) :
      SchemaRegistryIndex.getForRegisterByInstance(instanceOrCls);

    adapter.registerMethod(property, ...config);
  };
}

/**
 * Add a custom validator for a given method
 *
 * @param fn The validator function
 */
export function MethodValidator<T extends (...args: Any[]) => Any>(fn: MethodValidatorFn<Parameters<T>>) {
  return Method({ validators: [castTo(fn)] });
}
