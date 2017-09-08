import { SchemaRegistry } from '@encore2/schema';
import { ModelOptions } from './types';
import { EventEmitter } from 'events';
import { MetadataRegistry, Class } from '@encore2/registry';

export class $ModelRegistry extends MetadataRegistry<ModelOptions> {
  constructor() {
    super(SchemaRegistry);
  }

  onNewClassConfig() {
    return {};
  }

  getByClass(cls: Class): ModelOptions {
    return this.classes.get(cls.__id) || {};
  }

  registerClass(cls: Class, options: Partial<ModelOptions>) {
    let pending = this.getOrCreateClassConfig(cls);

    if (options.defaultSort) {
      pending.defaultSort = options.defaultSort;
    }
    if (options.discriminator) {
      pending.discriminator = options.discriminator;
    }
    if (options.extra) {
      pending.extra = Object.assign({}, pending.extra || {}, options.extra);
    }
    if (options.subtypes) {
      pending.subtypes = Object.assign({}, pending.subtypes || {}, options.subtypes);
    }
    if (options.defaultSort) { }
  }

  onInstallFinalize<T>(cls: Class<T>) {
    return this.pendingClasses.get(cls.__id)! as ModelOptions;
  }
}

export const ModelRegistry = new $ModelRegistry();