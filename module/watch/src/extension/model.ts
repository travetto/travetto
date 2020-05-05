import type * as m from '@travetto/model';
import type * as s from '@travetto/schema';

export function ModelAdaptor(svc: m.ModelService) {
  const src = svc['source'];
  if (src.onChange || src.onSchemaChange) {
    const ModelRegistry: typeof m.ModelRegistry = require('@travetto/model').ModelRegistry;
    if (src.onSchemaChange) {
      const SchemaRegistry: typeof s.SchemaRegistry = require('@travetto/schema').SchemaRegistry;
      SchemaRegistry.onSchemaChange(event => {
        if (ModelRegistry.has(event.cls)) {
          src.onSchemaChange!(event);
        }
      });
    }
    if (src.onChange) {
      ModelRegistry.on(src.onChange.bind(src));
    }
  }
}