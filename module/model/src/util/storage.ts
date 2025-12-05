import { Class, hasFunction, Runtime } from '@travetto/runtime';
import { SchemaChangeListener, SchemaRegistryIndex } from '@travetto/schema';
import { Registry } from '@travetto/registry';

import { ModelStorageSupport } from '../types/storage.ts';
import { ModelRegistryIndex } from '../registry/registry-index.ts';

/**
 * Model storage util
 */
export class ModelStorageUtil {

  /**
   * Type guard for determining if service supports storage operation
   */
  static isSupported = hasFunction<ModelStorageSupport>('createStorage');

  /**
   * Register change listener on startup
   */
  static async registerModelChangeListener(storage: ModelStorageSupport): Promise<void> {
    if (!Runtime.dynamic || !(storage?.config?.autoCreate ?? !Runtime.production)) {
      return;
    }

    const checkType = (cls: Class, enforceBase = true): boolean => {
      if (enforceBase && SchemaRegistryIndex.getBaseClass(cls) !== cls) {
        return false;
      }
      const { autoCreate } = ModelRegistryIndex.getConfig(cls) ?? {};
      return autoCreate ?? false;
    };

    // If listening for model add/removes/updates
    if (storage.createModel || storage.deleteModel || storage.changeModel) {
      Registry.onClassChange(ModelRegistryIndex, {
        async onAdded(cls, previous) {
          if (previous) {
            checkType(cls, true) && storage.changeModel?.(cls);
          } else {
            checkType(cls) && storage.createModel?.(cls);
          }
        },
        async onRemoved(cls, replacedBy) {
          checkType(cls) && !replacedBy && storage.deleteModel?.(cls);
        },
      });
    }

    // Initialize on startup (test manages)
    await storage.createStorage();

    if (storage.createModel) {
      for (const cls of ModelRegistryIndex.getClasses()) {
        if (checkType(cls)) {
          await storage.createModel(cls);
        }
      }
    }

    // If listening for model add/removes/updates
    if (storage.changeSchema) {
      SchemaChangeListener.onSchemaChange(event => {
        if (checkType(event.cls)) {
          storage.changeSchema!(event.cls, event.change);
        }
      });
    }
  }
}