import type { RegistryAdapter } from '@travetto/registry';
import { type Class, RuntimeError, Util, castTo } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

import type { ModelConfig } from './types.ts';

const DEFAULT_ID_PATTERN = /^[0-9a-f]{32}$/i;
const DEFAULT_ID_GENERATOR = (): string => Util.uuid(32);

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

  constructor(cls: Class) {
    this.#cls = cls;
  }

  register(...data: Partial<ModelConfig>[]): ModelConfig {
    const config = (this.#config ??= {
      class: this.#cls,
      indices: {},
      autoCreate: 'development',
      store: this.#cls.name,
      idGenerator: DEFAULT_ID_GENERATOR,
      postLoad: [],
      prePersist: [],
      transientFields: []
    });
    combineClasses(config, data);
    return config;
  }

  finalize(parent?: ModelConfig): void {
    const config = this.#config;
    if (parent) {
      const parentSchema = parent && SchemaRegistryIndex.has(parent.class) ? SchemaRegistryIndex.getConfig(parent.class) : undefined;

      if (parentSchema?.discriminatedField && parent.store) {
        config.store = parent.store;
      }

      if (parent.idField && !config.idField) {
        config.idField = parent.idField;
      }

      if (parent.idGenerator && config.idGenerator === DEFAULT_ID_GENERATOR) {
        config.idGenerator = parent.idGenerator;
      }

      config.postLoad = [...(parent.postLoad ?? []), ...(config.postLoad ?? [])];
      config.prePersist = [...(parent.prePersist ?? []), ...(config.prePersist ?? [])];
      config.transientFields = [...(parent.transientFields ?? []), ...(config.transientFields ?? [])];
    }

    const schemaFields = SchemaRegistryIndex.getForRegister(this.#cls, true).get()?.fields ?? {};
    const modelIdField = Object.values(schemaFields).find(field => field.aliases?.includes('modelId'))?.name;
    const idField = config.idField ?? modelIdField;

    if (!idField) {
      throw new RuntimeError(`Model ${this.#cls.name} is missing a ModelId (primary identifier) field`);
    }

    config.idField = castTo(idField);
    const idFieldConfig = schemaFields[idField];
    const match = config.idGenerator === DEFAULT_ID_GENERATOR && !idFieldConfig?.match ? { regex: DEFAULT_ID_PATTERN } : undefined;
    SchemaRegistryIndex.getForRegister(this.#cls, true).registerField(castTo(idField), {
      required: { active: false },
      ...(match ? { match } : {})
    });
  }

  get(): ModelConfig {
    return this.#config;
  }
}
