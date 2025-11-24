import { Class, ClassInstance } from '@travetto/runtime';

import { SchemaCoreConfig } from '../service/types.ts';
import { SchemaRegistryIndex } from '../service/registry-index.ts';

function isClassInstance(o: Class | ClassInstance, property?: string | symbol): o is ClassInstance {
  return !!property;
}

/**
 * Describe a model or a field
 * @param config The describe configuration
 * @augments `@travetto/schema:Describe`
 */
export function Describe(config: Partial<Omit<SchemaCoreConfig, 'metadata'>>) {
  return (instanceOrClass: Class | ClassInstance, property?: string | symbol, descOrIdx?: PropertyDescriptor | number): void => {
    if (isClassInstance(instanceOrClass, property)) {
      if (descOrIdx !== undefined && typeof descOrIdx === 'number') {
        SchemaRegistryIndex.getForRegister(instanceOrClass.constructor).registerParameter(property!, descOrIdx, { ...config });
      } else {
        SchemaRegistryIndex.getForRegister(instanceOrClass.constructor).registerField(property!, config);
      }
    } else {
      SchemaRegistryIndex.getForRegister(instanceOrClass).register(config);
    }
  };
}

/**
 * Mark a field/method as ignored
 *
 * @augments `@travetto/schema:Ignore`
 */
export function Ignore(): PropertyDecorator {
  return () => { };
}
