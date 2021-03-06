import { Class, ClassInstance } from '@travetto/base';

import { DescribableConfig } from '../service/types';
import { SchemaRegistry } from '../service/registry';

/**
 * Describe a model or a field
 * @param config The describe configuration
 * @augments `@trv:schema/Describe`
 */
export function Describe(config: Partial<DescribableConfig>) {
  return (target: Class | ClassInstance, property?: string, descOrIdx?: PropertyDescriptor | number) => {
    if (property) {
      if (descOrIdx !== undefined && typeof descOrIdx === 'number') {
        property = `${property}.${descOrIdx}`;
      }
      SchemaRegistry.registerPendingFieldFacet((target as ClassInstance).constructor, property!, config);
    } else {
      SchemaRegistry.register(target as Class, config);
    }
  };
}