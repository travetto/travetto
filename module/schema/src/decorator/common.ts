import { DescribableConfig } from '../service/types';
import { SchemaRegistry } from '../service/registry';

/**
 * Describe a model or a field
 * @param config The describe configuration
 * @augments `@trv:schema/describe`
 */
export function Describe(config: Partial<DescribableConfig>) {
  return (target: any, property?: string, descriptor?: PropertyDescriptor) => {
    if (property) {
      SchemaRegistry.registerPendingFieldFacet(target.constructor, property!, config);
      return descriptor;
    } else {
      SchemaRegistry.register(target, config);
    }
  };
}