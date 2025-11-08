import { ClassInstance } from '@travetto/runtime';

import { MethodConfig } from '../service/types';
import { SchemaRegistryIndex } from '../service/registry-index';

/**
 * Registering a method
 * @param config The method configuration
 * @augments `@travetto/schema:Method`
 */
export function Method(...config: Partial<MethodConfig>[]) {
  return (f: ClassInstance, k: string | symbol): void => {
    SchemaRegistryIndex.getForRegister(f).registerMethod(k, ...config);
  };
}
