import { Class, ClassInstance } from '@travetto/runtime';
import { RegistryV2 } from '@travetto/registry';

import { DescribableConfig } from '../service/types.ts';
import { SchemaRegistry } from '../service/registry.ts';
import { SchemaRegistryIndex } from '../service/registry-index.ts';

function isClassInstance(o: Class | ClassInstance, property?: string): o is ClassInstance {
  return !!property;
}

/**
 * Describe a model or a field
 * @param config The describe configuration
 * @augments `@travetto/schema:Describe`
 */
export function Describe(config: Partial<DescribableConfig>) {
  return (target: Class | ClassInstance, property?: string, descOrIdx?: PropertyDescriptor | number): void => {
    if (isClassInstance(target, property)) {
      if (descOrIdx !== undefined && typeof descOrIdx === 'number') {
        RegistryV2.get(SchemaRegistryIndex, target).registerParameter(property!, descOrIdx, {
          name: property!,
          ...config
        });
      } else {
        RegistryV2.get(SchemaRegistryIndex, target).registerField(property!, config);
      }
    } else {
      SchemaRegistry.register(target, config);
    }
  };
}