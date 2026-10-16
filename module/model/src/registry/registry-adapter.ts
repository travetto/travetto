import type { RegistryAdapter } from '@travetto/registry';
import { type Class, Util } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import type { ModelConfig } from './types.ts';

function combineClasses(target: ModelConfig, sources: Partial<ModelConfig>[]): ModelConfig {
  for (const source of sources) {
    Object.assign(target, source, {
      indices: { ...(target.indices || {}), ...(source.indices || {}) },
      postLoad: [...(target.postLoad || []), ...(source.postLoad || [])],
      prePersist: [...(target.prePersist || []), ...(source.prePersist || [])],
      transientFields: [...(target.transientFields || []), ...(source.transientFields || [])]
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
  #hasCustomGenerator = false;

  constructor(cls: Class) {
    this.#cls = cls;
  }

  register(...data: Partial<ModelConfig>[]): ModelConfig {
    const config = (this.#config ??= {
      class: this.#cls,
      indices: {},
      autoCreate: 'development',
      store: this.#cls.name,
      idGenerator: (): string => Util.uuid(32),
      postLoad: [],
      prePersist: [],
      transientFields: []
    });
    if (data.some(d => d.idGenerator)) {
      this.#hasCustomGenerator = true;
    }
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

      if (parent.idField && !config.idField) {
        config.idField = parent.idField;
      }

      if (parent.idGenerator && !this.#hasCustomGenerator) {
        config.idGenerator = parent.idGenerator;
      }

      config.postLoad = [...(parent.postLoad ?? []), ...(config.postLoad ?? [])];
      config.prePersist = [...(parent.prePersist ?? []), ...(config.prePersist ?? [])];
      config.transientFields = [...(parent.transientFields ?? []), ...(config.transientFields ?? [])];
    }
  }

  get(): ModelConfig {
    return this.#config;
  }
}
