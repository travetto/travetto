import { EnvUtil } from '@travetto/boot';
import { DependencyRegistry } from '@travetto/di';
import { AppManifest, Class } from '@travetto/base';
import { SchemaRegistry } from '@travetto/schema';

import { ModelRegistry } from '../../registry/model';
import { ModelStorageSupport } from '../../service/storage';
import { ModelType } from '../../types/model';

/**
 * Model storage util
 */
export class ModelStorageUtil {
  /**
   * Register change listener on startup
   */
  static async registerModelChangeListener(storage: ModelStorageSupport, target?: Class) {
    if (EnvUtil.isReadonly() || !(storage?.config?.autoCreate ?? !AppManifest.prod)) {
      return;
    }

    target = target ?? storage.constructor as Class<ModelStorageSupport>;


    const checkType = (cls: Class, enforceBase = true) => {
      if (enforceBase && ModelRegistry.getBaseModel(cls) !== cls) {
        return false;
      }
      const sym = ModelRegistry.get(cls)?.for;
      return !sym || DependencyRegistry.getCandidateTypes(target!).find(x => x.qualifier === sym);
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

    // If listening for model add/removes/updates
    if (storage.changeSchema) {
      SchemaRegistry.onSchemaChange(ev => {
        if (checkType(ev.cls)) {
          storage.changeSchema!(ev.cls, ev.change);
        }
      });
    }
  }
}