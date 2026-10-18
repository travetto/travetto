import type { RegistryAdapter } from '@travetto/registry';
import { type Class, RuntimeError, castTo } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import type { ModelId, ModelType } from '../types/model.ts';
import { ModelIdSource } from './model-id.ts';
import type { ModelConfig } from './types.ts';

function combineClasses(target: ModelConfig, sources: Partial<ModelConfig>[]): ModelConfig {
  for (const source of sources) {
    Object.assign(target, source, {
      indices: { ...(target.indices || {}), ...(source.indices || {}) },
      postLoad: [...(target.postLoad || []), ...(source.postLoad || [])],
      prePersist: [...(target.prePersist || []), ...(source.prePersist || [])],
      transientFields: [...(target.transientFields || []), ...(source.transientFields || [])]
    });
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
    return this.#idSource;
  }

  register(...data: Partial<ModelConfig>[]): ModelConfig {
    const config = (this.#config ??= castTo({
      class: this.#cls,
      indices: {},
      autoCreate: 'development',
      idField: undefined!,
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
      const [idField, ...othersFields] = Object.values(schemaFields).filter(field => field.specifiers?.includes('modelId'));
      if (idField) {
        if (othersFields.length) {
          throw new RuntimeError(`Model ${this.#cls.name} has multiple ModelId (primary identifier) fields`);
        }
        config.idField = idField.name;
      } else if (schemaFields.id) {
        config.idField = 'id';
      } else {
        throw new RuntimeError(`Model ${this.#cls.name} is missing a ModelId (primary identifier) field`);
      }
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

      config.postLoad = [...(parent.postLoad ?? []), ...(config.postLoad ?? [])];
      config.prePersist = [...(parent.prePersist ?? []), ...(config.prePersist ?? [])];
      config.transientFields = [...(parent.transientFields ?? []), ...(config.transientFields ?? [])];
    }

    this.#idSource = new ModelIdSource(this.#cls, schemaFields[config.idField]);
  }

  get(): ModelConfig {
    return this.#config;
  }

  ensureId<T extends ModelType>(item: T): ModelId {
    return this.idSource.getOrSet(item);
  }
}
