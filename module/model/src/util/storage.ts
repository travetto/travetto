import { Class, hasFunction, Runtime } from '@travetto/runtime';
import { SchemaChangeListener } from '@travetto/schema';
import { RegistryV2 } from '@travetto/registry';

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
      if (enforceBase && ModelRegistryIndex.getBaseModelClass(cls) !== cls) {
        return false;
      }
      const { autoCreate } = ModelRegistryIndex.getModelOptions(cls) ?? {};
      return autoCreate ?? false;
    };

    // If listening for model add/removes/updates
    if (storage.createModel || storage.deleteModel || storage.changeModel) {
      RegistryV2.onClassChange(ev => {
        switch (ev.type) {
          case 'added': checkType(ev.curr) ? storage.createModel?.(ev.curr) : undefined; break;
          case 'changed': checkType(ev.curr, false) ? storage.changeModel?.(ev.curr) : undefined; break;
          case 'removing': checkType(ev.prev) ? storage.deleteModel?.(ev.prev) : undefined; break;
        }
      }, ModelRegistryIndex);
    }

    // Initialize on startup (test manages)
    await storage.createStorage();

    if (storage.createModel) {
      for (const cls of RegistryV2.getClasses(ModelRegistryIndex)) {
        if (checkType(cls)) {
          await storage.createModel(cls);
        }
      }
    }

    // If listening for model add/removes/updates
    if (storage.changeSchema) {
      SchemaChangeListener.onSchemaChange(ev => {
        if (checkType(ev.cls)) {
          storage.changeSchema!(ev.cls, ev.change);
        }
      });
    }
  }
}