import { Class, ClassInstance } from '@travetto/runtime';

import { DescribableConfig } from '../service/types';
import { SchemaRegistry } from '../service/registry';

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
        SchemaRegistry.registerPendingParamFacet(target.constructor, property!, descOrIdx, config);
      } else {
        SchemaRegistry.registerPendingFieldFacet(target.constructor, property!, config);
      }
    } else {
      SchemaRegistry.register(target, config);
    }
  };
}