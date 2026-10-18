import type { RegistryAdapter } from '@travetto/registry';
import { type Class, RuntimeError, Util, castTo } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import type { ModelId, ModelType } from '../types/model.ts';
import { ModelIdSource } from './model-id.ts';
import type { ModelConfig } from './types.ts';

const DEFAULT_ID_GENERATOR = (): string => Util.uuid(32);

function combineClasses(target: ModelConfig, sources: Partial<ModelConfig>[]): ModelConfig {
  for (const source of sources) {
    Object.assign(target, source, {
      indices: { ...(target.indices || {}), ...(source.indices || {}) },
      postLoad: [...(target.postLoad || []), ...(source.postLoad || [])],
      prePersist: [...(target.prePersist || []), ...(source.prePersist || [])],
      transientFields: [...(target.transientFields || []), ...(source.transientFields || [])]
    });
    if (source.idGenerator) {
      target.idGenerator = source.idGenerator;
    }
    if (source.idField) {
      target.idField = source.idField;
    }
  }
  if (target.store) {
    target.store = target.store.toLowerCase().replace(/[^A-Za-z0-9_]+/g, '_');
  }
  return target;
}

export class ModelRegistryAdapter implements RegistryAdapter<ModelConfig> {
  #cls: Class;
  #config: ModelConfig;
  #idSource: ModelIdSource;

  constructor(cls: Class) {
    this.#cls = cls;
  }

  get idSource(): ModelIdSource {
    return (this.#idSource ??= new ModelIdSource(this.#cls, this.#config.idField));
  }

  register(...data: Partial<ModelConfig>[]): ModelConfig {
    const config = (this.#config ??= castTo({
      class: this.#cls,
      indices: {},
      autoCreate: 'development',
      idField: undefined!,
      idGenerator: undefined!,
      store: this.#cls.name,
      postLoad: [],
      prePersist: [],
      transientFields: []
    }));
    combineClasses(config, data);
    return config;
  }

  finalize(parent?: ModelConfig): void {
    const config = this.#config;
    const schemaFields = SchemaRegistryIndex.getForRegister(this.#cls, true).get()?.fields ?? {};

    config.idField ??= parent?.idField ?? undefined!;

    // Establish id field
    if (!config.idField) {
      const modelIdFields = Object.values(schemaFields).filter(field => field.specifiers?.includes('modelId'));
      if (!modelIdFields.length) {
        throw new RuntimeError(`Model ${this.#cls.name} is missing a ModelId (primary identifier) field`);
      } else if (modelIdFields.length > 1) {
        throw new RuntimeError(`Model ${this.#cls.name} has multiple ModelId (primary identifier) fields`);
      }
      config.idField = modelIdFields[0].name;
    }

    if (this.#config.indices) {
      for (const indexConfig of Object.values(this.#config.indices)) {
        if ('fields' in indexConfig && Array.isArray(indexConfig.fields) && indexConfig.fields.some(field => field === config.idField)) {
          throw new RuntimeError('Cannot create an index with the id field', {
            details: indexConfig
          });
        }
      }
    }

    if (parent) {
      const parentSchema = parent && SchemaRegistryIndex.has(parent.class) ? SchemaRegistryIndex.getConfig(parent.class) : undefined;

      if (parentSchema?.discriminatedField && parent.store) {
        config.store = parent.store;
      }

      config.idGenerator ??= parent.idGenerator;
      config.postLoad = [...(parent.postLoad ?? []), ...(config.postLoad ?? [])];
      config.prePersist = [...(parent.prePersist ?? []), ...(config.prePersist ?? [])];
      config.transientFields = [...(parent.transientFields ?? []), ...(config.transientFields ?? [])];
    }
    config.idGenerator ??= DEFAULT_ID_GENERATOR;
  }

  get(): ModelConfig {
    return this.#config;
  }

  ensureId<T extends ModelType>(item: T): ModelId {
    return this.idSource.getOrSet(item, this.#config.idGenerator);
  }
}
