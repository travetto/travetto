import { Class, hasFunction, Runtime } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

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
   * Storage Initialization
   */
  static async storageInitialization(storage: ModelStorageSupport): Promise<void> {
    if (storage.config?.modifyStorage === false) {
      return;
    }

    const checkType = (cls: Class, enforceBase = true): boolean => {
      if (enforceBase && SchemaRegistryIndex.getBaseClass(cls) !== cls) {
        return false;
      }

      const { autoCreate = 'development' } = ModelRegistryIndex.getConfig(cls) ?? {};

      if (autoCreate === 'off') {
        return false;
      }

      return (autoCreate === 'production' || !Runtime.production);
    };

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