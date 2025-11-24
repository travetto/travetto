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
  return (instanceOrCls: Class | ClassInstance, property?: string | symbol, descOrIdx?: PropertyDescriptor | number): void => {
    if (isClassInstance(instanceOrCls, property)) {
      if (descOrIdx !== undefined && typeof descOrIdx === 'number') {
        SchemaRegistryIndex.getForRegister(instanceOrCls.constructor).registerParameter(property!, descOrIdx, { ...config });
      } else {
        SchemaRegistryIndex.getForRegister(instanceOrCls.constructor).registerField(property!, config);
      }
    } else {
      SchemaRegistryIndex.getForRegister(instanceOrCls).register(config);
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
