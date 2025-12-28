import type { RegistryAdapter } from '@travetto/registry';
import { Class } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import { ModelConfig } from './types';

function combineClasses(target: ModelConfig, sources: Partial<ModelConfig>[]): ModelConfig {
  for (const source of sources) {
    Object.assign(target, source, {
      indices: [...(target.indices || []), ...(source.indices || [])],
      postLoad: [...(target.postLoad || []), ...(source.postLoad || [])],
      prePersist: [...(target.prePersist || []), ...(source.prePersist || [])],
    });
  }
  if (target.store) {
    target.store = target.store.toLowerCase().replace(/[^A-Za-z0-9_]+/g, '_');
  }
  return target;
}

export class ModelRegistryAdapter implements RegistryAdapter<ModelConfig> {
  #cls: Class;
  #config: ModelConfig;

  constructor(cls: Class) {
    this.#cls = cls;
  }

  register(...data: Partial<ModelConfig>[]): ModelConfig {
    const config = this.#config ??= {
      class: this.#cls,
      indices: [],
      autoCreate: 'development',
      store: this.#cls.name,
      postLoad: [],
      prePersist: []
    };
    combineClasses(config, data);
    return config;
  }

  finalize(parent?: ModelConfig): void {
    const config = this.#config;
    if (parent) {
      const parentSchema = parent ? SchemaRegistryIndex.getConfig(parent.class) : undefined; // Ensure schema is finalized first

      if (parentSchema?.discriminatedField && parent.store) {
        config.store = parent.store;
      }

      config.postLoad = [...parent.postLoad ?? [], ...config.postLoad ?? []];
      config.prePersist = [...parent.prePersist ?? [], ...config.prePersist ?? []];
    }
  }

  get(): ModelConfig {
    return this.#config;
  }
}