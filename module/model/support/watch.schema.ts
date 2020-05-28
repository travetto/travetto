import { Class } from '@travetto/registry';
import type { ModelService } from '../src/service/model';

/**
 * Wraps a model service registering listeners for model and schema change
 */
export function watch(svc: Class<ModelService>) {
  const ogInit = svc.prototype.init;

  /**
   * Updates the init operation
   */
  svc.prototype.init = async function (this: ModelService) {
    await ogInit.call(this);
    const src = this['source'];

    // Listen for changes
    if (src.onChange || src.onSchemaChange) {

      const { ModelRegistry } = await import('../src/registry/registry');
      // If listening for model add/removes/updates
      if (src.onChange) {
        ModelRegistry.on(src.onChange.bind(src));
      }
      // If listening to schema changes
      if (src.onSchemaChange) {
        const { SchemaRegistry } = await import('@travetto/schema');
        // Process changes as schema updates
        SchemaRegistry.onSchemaChange(event => {
          if (ModelRegistry.has(event.cls)) {
            src.onSchemaChange!(event);
          }
        });
      }
    }
  };
}