import type { RegistryAdapter, RegistryIndexClass } from '@travetto/registry';
import { AppError, Class, describeFunction } from '@travetto/runtime';

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

  registerField(_field: string | symbol, ..._data: Partial<{}>[]): {} {
    throw new AppError('Method not implemented.');
  }


  registerMethod(_method: string | symbol, ..._data: Partial<{}>[]): {} {
    throw new AppError('Method not implemented.');
  }

  unregister(): void {

  }

  finalize(parent?: ClassType): void {
    const config = this.#config;
    if (parent) {
      config.postLoad = [...parent.postLoad ?? [], ...config.postLoad ?? []];
      config.prePersist = [...parent.prePersist ?? [], ...config.prePersist ?? []];
    }
  }

  getClass(): ClassType {
    return this.#config;
  }

  getField(_field: string | symbol): {} {
    throw new Error('Method not implemented.');
  }

  getMethod(_method: string | symbol): {} {
    throw new Error('Method not implemented.');
  }
}