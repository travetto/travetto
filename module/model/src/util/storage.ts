import { Class, hasFunction, Runtime } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';
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
   * Should we auto create models on startup
   */
  static shouldAutoCreate(storage: unknown): storage is ModelStorageSupport {
    return this.isSupported(storage) && (Runtime.dynamic || storage.config?.autoCreate === true);
  }

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
      Registry.onClassChange(event => {
        switch (event.type) {
          case 'create': checkType(event.current) ? storage.createModel?.(event.current) : undefined; break;
          case 'update': checkType(event.current, false) ? storage.changeModel?.(event.current) : undefined; break;
          case 'delete': checkType(event.previous) ? storage.deleteModel?.(event.previous) : undefined; break;
        }
      }, ModelRegistryIndex);
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
  }
}