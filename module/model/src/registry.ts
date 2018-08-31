import { SchemaRegistry, SchemaChangeEvent } from '@travetto/schema';
import { MetadataRegistry, Class } from '@travetto/registry';
import { DependencyRegistry } from '@travetto/di';

import { ModelOptions } from './types';

export class $ModelRegistry extends MetadataRegistry<ModelOptions<any>> {
  constructor() {
    super(SchemaRegistry, DependencyRegistry);
  }

  createPending(cls: Class) {
    return { class: cls };
  }

  onInstallFinalize<T>(cls: Class<T>) {
    return this.pending.get(cls.__id)! as ModelOptions<T>;
  }

  onSchemaChange(cb: (x: SchemaChangeEvent) => void) {
    SchemaRegistry.onSchemaChange((e) => {
      if (this.has(e.cls)) {
        cb(e);
      }
    });
  }
}

export const ModelRegistry = new $ModelRegistry();