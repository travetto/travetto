import { Class, ClassInstance } from '@travetto/base';

import { DescribableConfig } from '../service/types';
import { SchemaRegistry } from '../service/registry';

/**
 * Describe a model or a field
 * @param config The describe configuration
 * @augments `@trv:schema/describe`
 */
export function Describe(config: Partial<DescribableConfig>) {
  return (target: Class | ClassInstance, property?: string, descriptor?: PropertyDescriptor) => {
    if (property) {
      SchemaRegistry.registerPendingFieldFacet((target as ClassInstance).constructor, property!, config);
      return descriptor;
    } else {
      SchemaRegistry.register(target as Class, config);
    }
  };
}