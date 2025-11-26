import { Class, ClassInstance, getClass } from '@travetto/runtime';

import { SchemaCoreConfig } from '../service/types.ts';
import { SchemaRegistryIndex } from '../service/registry-index.ts';

/**
 * Describe a model or a field
 * @param config The describe configuration
 * @augments `@travetto/schema:Input`
 */
export function Describe(config: Partial<Omit<SchemaCoreConfig, 'metadata'>>) {
  return (instanceOrCls: Class | ClassInstance, property?: string | symbol, descOrIdx?: PropertyDescriptor | number): void => {
    const adapter = SchemaRegistryIndex.getForRegister(getClass(instanceOrCls));
    if (!property) {
      adapter.register(config);
    } else {
      if (descOrIdx !== undefined && typeof descOrIdx === 'number') {
        adapter.registerParameter(property, descOrIdx, config);
      } else if (typeof descOrIdx === 'object' && typeof descOrIdx.value === 'function') {
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
 */
export const IsPrivate = (): (instanceOrCls: Class | ClassInstance, property?: string | symbol) => void => Describe({ private: true });

/**
 * Mark a field/method as ignored
 * @augments `@travetto/schema:Ignore`
 */
export function Ignore(): PropertyDecorator {
  return () => { };
}
