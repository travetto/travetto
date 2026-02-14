import type { Client } from '@elastic/elasticsearch';
import type * as estypes from '@elastic/elasticsearch/api/types';

import { JSONUtil, type Class } from '@travetto/runtime';
import { ModelRegistryIndex, type ModelType, type ModelStorageSupport } from '@travetto/model';

import type { ElasticsearchModelConfig } from './config.ts';
import { ElasticsearchSchemaUtil } from './internal/schema.ts';

/**
 * Manager for elasticsearch indices and schemas
 */
export class IndexManager implements ModelStorageSupport {

  #identities = new Map<Class, { index: string }>();
  #client: Client;
  config: ElasticsearchModelConfig;

  constructor(config: ElasticsearchModelConfig, client: Client) {
    this.config = config;
    this.#client = client;
  }

  getStore(cls: Class): string {
    return ModelRegistryIndex.getStoreName(cls);
  }

  /**
   * Get namespaced index
   * @param idx
   */
  getNamespacedIndex(idx: string): string {
    if (this.config.namespace) {
      return `${this.config.namespace}_${idx}`;
    } else {
      return idx;
    }
  }

  /**
   * Build the elasticsearch identity set for a given class (index)
   */
  getIdentity<T extends ModelType>(cls: Class<T>): { index: string } {
    if (!this.#identities.has(cls)) {
      const col = this.getStore(cls);
      const index = this.getNamespacedIndex(col);
      this.#identities.set(cls, { index });
    }
    return { ...this.#identities.get(cls)! };
  }

  /**
   * Create index for type
   * @param cls
   * @param alias
   */
  async createIndex(cls: Class, alias = true): Promise<string> {
    const mapping = ElasticsearchSchemaUtil.generateSchemaMapping(cls, this.config.schemaConfig);
    const { index } = this.getIdentity(cls); // Already namespaced
    const concreteIndex = `${index}_${Date.now()}`;
    try {
      await this.#client.indices.create({
        index: concreteIndex,
        mappings: mapping,
        settings: this.config.indexCreate,
        ...(alias ? { aliases: { [index]: {} } } : {})
      });
      console.debug('Index created', { index, concrete: concreteIndex });
      console.debug('Index Config', {
        mappings: mapping,
        settings: this.config.indexCreate
      });
    } catch (error) {
      console.warn('Index already created', { index, error });
    }
    return concreteIndex;
  }

  async exportModel(cls: Class<ModelType>): Promise<string> {
    const schema = ElasticsearchSchemaUtil.generateSchemaMapping(cls, this.config.schemaConfig);
    const { index } = this.getIdentity(cls); // Already namespaced
    return `curl -XPOST $ES_HOST/${index} -d '${JSONUtil.toUTF8({
      mappings: schema,
      settings: this.config.indexCreate
    })}'`;
  }

  async deleteModel(cls: Class<ModelType>): Promise<void> {
    const { index } = this.getIdentity(cls);
    const aliasedIndices = await this.#client.indices.getAlias();

    const toDelete = Object.keys(aliasedIndices[index]?.aliases ?? {})
      .filter(item => index in (aliasedIndices[item]?.aliases ?? {}));

    console.debug('Deleting Model', { index, toDelete });
    await Promise.all(toDelete.map(target => this.#client.indices.delete({ index: target })));
  }

  /**
   * Create or update schema as necessary
   */
  async upsertModel(cls: Class<ModelType>): Promise<void> {
    const { index } = this.getIdentity(cls);
    const resolvedAlias = await this.#client.indices.getMapping({ index }).catch(() => undefined);

    if (resolvedAlias) {
      const [currentIndex] = Object.keys(resolvedAlias ?? {});
      const pendingMapping = ElasticsearchSchemaUtil.generateSchemaMapping(cls, this.config.schemaConfig);
      const changedFields = ElasticsearchSchemaUtil.getChangedFields(resolvedAlias[currentIndex].mappings, pendingMapping);

      if (changedFields.length) { // If any fields changed, reindex
        console.debug('Updated Model', { index, currentIndex, changedFields });
        const pendingIndex = await this.createIndex(cls, false);

        const reindexBody: estypes.ReindexRequest = {
          source: { index: currentIndex },
          dest: { index: pendingIndex },
          script: {
            lang: 'painless',
            source: changedFields.map(change => `ctx._source.remove("${change}");`).join(' ') // Removing
          },
          wait_for_completion: true
        };

        await this.#client.reindex(reindexBody);

        // Update aliases
        await this.#client.indices.putAlias({ index: pendingIndex, name: index });
        const toDelete = Object.keys(resolvedAlias).filter(item => item !== pendingIndex);
        await Promise.all(toDelete.map(alias => this.#client.indices.delete({ index: alias })));
      }
    } else { // Create if non-existent
      console.debug('Creating Model', { index });
      await this.createIndex(cls);
    }
  }

  async createStorage(): Promise<void> {
    console.debug('Create Storage', { idx: this.getNamespacedIndex('*') });
  }

  async deleteStorage(): Promise<void> {
    console.debug('Deleting storage', { idx: this.getNamespacedIndex('*') });
    await this.#client.indices.delete({
      index: this.getNamespacedIndex('*')
    });
  }
}