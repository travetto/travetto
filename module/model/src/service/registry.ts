import { SchemaRegistry } from '@travetto/schema';
import { ModelOptions } from './types';
import { EventEmitter } from 'events';
import { MetadataRegistry, Class } from '@travetto/registry';
import { DependencyRegistry } from '@travetto/di';

export class $ModelRegistry extends MetadataRegistry<ModelOptions> {
  constructor() {
    super(SchemaRegistry, DependencyRegistry);
  }

  createPending(cls: Class) {
    return { class: cls };
  }

  onInstallFinalize<T>(cls: Class<T>) {
    return this.pending.get(cls.__id)! as ModelOptions;
  }
}

export const ModelRegistry = new $ModelRegistry();