import { DescriableConfig } from '../types';
import { SchemaRegistry } from '../service';

export function Describe(config: Partial<DescriableConfig>) {
  return (target: any, property?: string, descriptor?: PropertyDescriptor) => {
    if (property) {
      SchemaRegistry.registerPendingFieldFacet(target.constructor, property!, config);
      return descriptor;
    } else {
      SchemaRegistry.register(target, config);
    }
  };
}