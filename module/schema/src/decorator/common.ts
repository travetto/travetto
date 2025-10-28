import { Class, ClassInstance } from '@travetto/runtime';
import { RegistryV2 } from '@travetto/registry';

import { DescribableConfig } from '../service/types.ts';
import { SchemaRegistryIndex } from '../service/registry-index.ts';

function isClassInstance(o: Class | ClassInstance, property?: string | symbol): o is ClassInstance {
  return !!property;
}

/**
 * Describe a model or a field
 * @param config The describe configuration
 * @augments `@travetto/schema:Describe`
 */
export function Describe(config: Partial<DescribableConfig>) {
  return (target: Class | ClassInstance, property?: string | symbol, descOrIdx?: PropertyDescriptor | number): void => {
    const adapter = RegistryV2.getForRegister(SchemaRegistryIndex, target);
    if (isClassInstance(target, property)) {
      if (descOrIdx !== undefined && typeof descOrIdx === 'number') {
        adapter.registerParameter(property!, descOrIdx, { ...config });
      } else {
        adapter.registerField(property!, config);
      }
    } else {
      adapter.register(target, config);
    }
  };
}