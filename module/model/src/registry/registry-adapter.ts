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
  return target;
}

export class ModelRegistryAdapter implements RegistryAdapter<ModelConfig> {
  #cls: Class;
  #config: ModelConfig;

  constructor(cls: Class) {
    this.#cls = cls;
  }

  register(...data: Partial<ModelConfig>[]): ModelConfig {
    const cfg = this.#config ??= {
      class: this.#cls,
      indices: [],
      autoCreate: true,
      store: this.#cls.name.toLowerCase(),
      postLoad: [],
      prePersist: []
    };
    combineClasses(cfg, data);
    return cfg;
  }

  finalize(parent?: ModelConfig): void {
    const config = this.#config;
    if (parent) {
      const parentSchema = parent ? SchemaRegistryIndex.getConfig(parent.class) : undefined; // Ensure schema is finalized first
      const schema = SchemaRegistryIndex.getConfig(this.#cls);

      if ((parentSchema?.baseType || schema.subType) && parent.store) {
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