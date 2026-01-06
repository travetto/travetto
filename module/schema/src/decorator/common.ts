import { type Class, type ClassInstance, getClass } from '@travetto/runtime';

import type { SchemaCoreConfig } from '../service/types.ts';
import { SchemaRegistryIndex } from '../service/registry-index.ts';

/**
 * Describe a model or a field
 * @param config The describe configuration
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Describe(config: Partial<Omit<SchemaCoreConfig, 'metadata'>>) {
  return (instanceOrCls: Class | ClassInstance, property?: string, descriptorOrIdx?: PropertyDescriptor | number): void => {
    const adapter = SchemaRegistryIndex.getForRegister(getClass(instanceOrCls));
    if (!property) {
      adapter.register(config);
    } else {
      if (descriptorOrIdx !== undefined && typeof descriptorOrIdx === 'number') {
        adapter.registerParameter(property, descriptorOrIdx, config);
      } else if (typeof descriptorOrIdx === 'object' && typeof descriptorOrIdx.value === 'function') {
        adapter.registerMethod(property, config);
      } else {
        adapter.registerField(property, config);
      }
    }
  };
}

/**
 * Mark a field/method as private
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export const IsPrivate = (): (instanceOrCls: Class | ClassInstance, property?: string) => void => Describe({ private: true });

/**
 * Mark a field/method as ignored
 * @augments `@travetto/schema:Ignore`
 * @kind decorator
 */
export function Ignore(): PropertyDecorator {
  return () => { };
}
