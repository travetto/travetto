import { Class, hasFunction, Runtime } from '@travetto/runtime';
import { SchemaChangeListener } from '@travetto/schema';

import { ModelRegistry } from '../registry/model.ts';
import { ModelStorageSupport } from '../types/storage.ts';
import { ModelType } from '../types/model.ts';

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
      if (enforceBase && ModelRegistry.getBaseModel(cls) !== cls) {
        return false;
      }
      const { autoCreate } = ModelRegistry.get(cls) ?? {};
      return autoCreate;
    };

    // If listening for model add/removes/updates
    if (storage.createModel || storage.deleteModel || storage.changeModel) {
      ModelRegistry.on<ModelType>(ev => {
        switch (ev.type) {
          case 'added': checkType(ev.curr!) ? storage.createModel?.(ev.curr!) : undefined; break;
          case 'changed': checkType(ev.curr!, false) ? storage.changeModel?.(ev.curr!) : undefined; break;
          case 'removing': checkType(ev.prev!) ? storage.deleteModel?.(ev.prev!) : undefined; break;
        }
      });
    }

    // Initialize on startup (test manages)
    await storage.createStorage();

    if (storage.createModel) {
      for (const cls of ModelRegistry.getClasses()) {
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