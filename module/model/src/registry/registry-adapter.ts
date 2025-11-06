import type { RegistryAdapter, RegistryIndexClass } from '@travetto/registry';
import { Class, describeFunction } from '@travetto/runtime';

import { ModelOptions } from './types';
import { ModelType } from '../types/model';

type ClassType = ModelOptions<ModelType>;

function combineClasses(target: ClassType, sources: Partial<ClassType>[]): ClassType {
  for (const source of sources) {
    Object.assign(target, source, {
      indices: [...(target.indices || []), ...(source.indices || [])],
      postLoad: [...(target.postLoad || []), ...(source.postLoad || [])],
      prePersist: [...(target.prePersist || []), ...(source.prePersist || [])],
    });
  }
  return target;
}

export class ModelRegistryAdapter implements RegistryAdapter<ModelOptions<ModelType>> {
  #cls: Class;
  #config: ModelOptions<ModelType>;
  indexCls: RegistryIndexClass<ModelOptions<ModelType>>;

  constructor(cls: Class) {
    this.#cls = cls;
  }

  register(...data: Partial<ClassType>[]): ClassType {
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

  finalize(parent?: ClassType): void {
    const config = this.#config;
    if (parent) {
      config.postLoad = [...parent.postLoad ?? [], ...config.postLoad ?? []];
      config.prePersist = [...parent.prePersist ?? [], ...config.prePersist ?? []];
    }
  }

  get(): ClassType {
    return this.#config;
  }
}