import { EnvUtil } from '@travetto/boot';
import { DependencyRegistry } from '@travetto/di';
import { ChangeEvent, Class } from '@travetto/registry';
import { SchemaRegistry } from '@travetto/schema';
import { ModelRegistry } from '../../registry/registry';
import { ModelStorageSupport } from '../../service/storage';
import { ModelType } from '../../types/model';

/**
 * Model storage util
 */
export class ModelStorageUtil {
  /**
   * Register change listener on startup
   */
  static async registerModelChangeListener(self: ModelStorageSupport) {
    if (EnvUtil.isReadonly()) {
      return;
    }

    const checkType = (cls: Class) => {
      const sym = ModelRegistry.get(cls)?.for;
      return !sym || DependencyRegistry.getCandidateTypes(self.constructor as Class).find(x => x.qualifier === sym);
    };

    // If listening for model add/removes/updates
    if (self.onModelVisibilityChange) {
      ModelRegistry.on(ev => {
        if (ev.type === 'added' || ev.type === 'removing') {
          if (checkType(ev.prev ?? ev.curr!)) {
            self.onModelVisibilityChange!(ev as ChangeEvent<Class<ModelType>>);
          }
        }
      });
    }

    // If listening for model add/removes/updates
    if (self.onModelSchemaChange) {
      SchemaRegistry.onSchemaChange(ev => {
        if (checkType(ev.cls)) {
          self.onModelSchemaChange!(ev);
        }
      });
    }
  }
}