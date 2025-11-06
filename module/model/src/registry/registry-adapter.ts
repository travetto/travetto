import type { RegistryAdapter, RegistryIndexClass } from '@travetto/registry';
import { Class, describeFunction } from '@travetto/runtime';

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
  indexCls: RegistryIndexClass<ModelConfig>;

  constructor(cls: Class) {
    this.#cls = cls;
  }

  register(...data: Partial<ModelConfig>[]): ModelConfig {
    const cfg = this.#config ??= {
      class: this.#cls,
      indices: [],
      autoCreate: true,
      baseType: describeFunction(this.#cls).abstract,
      postLoad: [],
      prePersist: []
    };
    combineClasses(cfg, data);
    return cfg;
  }

  finalize(parent?: ModelConfig): void {
    const config = this.#config;
    if (parent) {
      config.postLoad = [...parent.postLoad ?? [], ...config.postLoad ?? []];
      config.prePersist = [...parent.prePersist ?? [], ...config.prePersist ?? []];
    }
  }

  get(): ModelConfig {
    return this.#config;
  }
}