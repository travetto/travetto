import { Class, ClassInstance } from '@travetto/base';

import { DescribableConfig } from '../service/types';
import { SchemaRegistry } from '../service/registry';

function isClassInstance(o: Class | ClassInstance, property?: string): o is ClassInstance {
  return !!property;
}

/**
 * Describe a model or a field
 * @param config The describe configuration
 * @augments `@trv:schema/Describe`
 */
export function Describe(config: Partial<DescribableConfig>) {
  return (target: Class | ClassInstance, property?: string, descOrIdx?: PropertyDescriptor | number): void => {
    if (isClassInstance(target, property)) {
      if (descOrIdx !== undefined && typeof descOrIdx === 'number') {
        property = `${property}.${descOrIdx}`;
      }
      SchemaRegistry.registerPendingFieldFacet(target.constructor, property!, config);
    } else {
      SchemaRegistry.register(target, config);
    }
  };
}