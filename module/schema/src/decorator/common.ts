import { Class, ClassInstance } from '@travetto/runtime';

import { SchemaCoreConfig } from '../service/types.ts';
import { SchemaRegistryIndex } from '../service/registry-index.ts';

function isClassInstance(o: Class | ClassInstance, property?: string | symbol): o is Class {
  return !property;
}

/**
 * Describe a model or a field
 * @param config The describe configuration
 * @augments `@travetto/schema:Describe`
 */
export function Describe(config: Partial<Omit<SchemaCoreConfig, 'metadata'>>) {
  return (instanceOrCls: Class | ClassInstance, property?: string | symbol, descOrIdx?: PropertyDescriptor | number): void => {
    if (isClassInstance(instanceOrCls, property)) {
      SchemaRegistryIndex.getForRegister(instanceOrCls).register(config);
    } else {
      const adapter = SchemaRegistryIndex.getForRegisterByInstance(instanceOrCls);
      if (descOrIdx !== undefined && typeof descOrIdx === 'number') {
        adapter.registerParameter(property!, descOrIdx, { ...config });
      } else {
        adapter.registerField(property!, config);
      }
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
