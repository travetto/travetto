import { Class, hasFunction, Runtime } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';
import { Registry } from '@travetto/registry';

import { ModelStorageSupport } from '../types/storage.ts';
import { ModelChangeSet, ModelRegistryIndex } from '../registry/registry-index.ts';

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
    if (storage.createModel || storage.deleteModel || storage.updateModel) {
      Registry.onClassChange(ModelRegistryIndex, {
        async onCreate(cls, previous) {
          if (previous) {
            checkType(cls, true) && storage.updateModel?.(cls);
          } else {
            checkType(cls) && storage.createModel?.(cls);
          }
        },
        async onDelete(cls, replacedBy) {
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
    if (storage.updateSchema) {
      SchemaRegistryIndex.onClassChange((events) => {
        const allChangeSets = new Map<Class, ModelChangeSet[]>();
        for (const event of events) {
          if (event.type === 'update') {
            const changeSets = ModelRegistryIndex.getModelChangeSets(event.current, event.previous);
            for (const changeSet of changeSets) {
              if (!allChangeSets.has(changeSet.modelCls)) {
                allChangeSets.set(changeSet.modelCls, []);
              }
              allChangeSets.get(changeSet.modelCls)!.push(changeSet);
            }
          }
        }
        for (const [cls, changeSets] of allChangeSets) {
          storage.updateSchema!(cls, changeSets);
        }
      });
    }
  }
}