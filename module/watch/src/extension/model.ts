import type * as m from '@travetto/model';
import type * as s from '@travetto/schema';

/**
 * Wraps a model service registering listeners for model and schema change
 */
export function ModelAdaptor(svc: m.ModelService) {
  const src = svc['source'];
  if (src.onChange || src.onSchemaChange) {
    const ModelRegistry: typeof m.ModelRegistry = require('@travetto/model').ModelRegistry;

    // If listening to schema changes
    if (src.onSchemaChange) {
      const SchemaRegistry: typeof s.SchemaRegistry = require('@travetto/schema').SchemaRegistry;
      // Process changes as schema updates
      SchemaRegistry.onSchemaChange(event => {
        if (ModelRegistry.has(event.cls)) {
          src.onSchemaChange!(event);
        }
      });
    }
    // If listening for model add/removes/updates
    if (src.onChange) {
      ModelRegistry.on(src.onChange.bind(src));
    }
  }
}