import { Client, estypes } from '@elastic/elasticsearch';

import { Class } from '@travetto/runtime';
import { ModelRegistryIndex, ModelType, ModelStorageSupport } from '@travetto/model';
import { SchemaChangeEvent, SchemaRegistryIndex } from '@travetto/schema';

import { ElasticsearchModelConfig } from './config.ts';
import { ElasticsearchSchemaUtil } from './internal/schema.ts';

/**
 * Manager for elasticsearch indices and schemas
 */
export class IndexManager implements ModelStorageSupport {

  #indexToAlias = new Map<string, string>();
  #aliasToIndex = new Map<string, string>();
  #identities = new Map<Class, { index: string }>();
  #client: Client;
  config: ElasticsearchModelConfig;

  constructor(config: ElasticsearchModelConfig, client: Client) {
    this.config = config;
    this.#client = client;
  }

  getStore(cls: Class): string {
    return ModelRegistryIndex.getStoreName(cls).toLowerCase().replace(/[^A-Za-z0-9_]+/g, '_');
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
   * Build alias mappings from the current state in the database
   */
  async computeAliasMappings(force = false): Promise<void> {
    if (force || !this.#indexToAlias.size) {
      const aliases = await this.#client.cat.aliases({ format: 'json' });

      this.#indexToAlias = new Map();
      this.#aliasToIndex = new Map();
      for (const al of aliases) {
        this.#indexToAlias.set(al.index!, al.alias!);
        this.#aliasToIndex.set(al.alias!, al.index!);
      }
    }
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

  /**
   * Build an index if missing
   */
  async createIndexIfMissing(cls: Class): Promise<void> {
    const baseCls = SchemaRegistryIndex.getBaseClass(cls);
    const identity = this.getIdentity(baseCls);
    try {
      await this.#client.search(identity);
    } catch {
      await this.createIndex(baseCls);
    }
  }

  async createModel(cls: Class<ModelType>): Promise<void> {
    await this.createIndexIfMissing(cls);
    await this.computeAliasMappings(true);
  }

  async exportModel(cls: Class<ModelType>): Promise<string> {
    const schema = ElasticsearchSchemaUtil.generateSchemaMapping(cls, this.config.schemaConfig);
    const { index } = this.getIdentity(cls); // Already namespaced
    return `curl -XPOST $ES_HOST/${index} -d '${JSON.stringify({
      mappings: schema,
      settings: this.config.indexCreate
    })}'`;
  }

  async deleteModel(cls: Class<ModelType>): Promise<void> {
    const alias = this.getNamespacedIndex(this.getStore(cls));
    if (this.#aliasToIndex.get(alias)) {
      await this.#client.indices.delete({
        index: this.#aliasToIndex.get(alias)!
      });
      await this.computeAliasMappings(true);
    }
  }

  /**
   * When the schema changes
   */
  async updateSchema(events: SchemaChangeEvent[]): Promise<void> {
    // Find which fields are gone
    const removes = change.subs.reduce<string[]>((toRemove, subChange) => {
      toRemove.push(...subChange.fields
        .filter(event => event.type === 'delete')
        .map(event => [...subChange.path.map(field => field.name), event.previous!.name].join('.')));
      return toRemove;
    }, []);

    // Find which types have changed
    const fieldChanges = change.subs.reduce<string[]>((toChange, subChange) => {
      toChange.push(...subChange.fields
        .filter(event => event.type === 'update')
        .filter(event => event.previous?.type !== event.current?.type)
        .map(event => [...subChange.path.map(field => field.name), event.previous!.name].join('.')));
      return toChange;
    }, []);

    const { index } = this.getIdentity(cls);

    // If removing fields or changing types, run as script to update data
    if (removes.length || fieldChanges.length) { // Removing and adding
      const next = await this.createIndex(cls, false);

      const aliases = (await this.#client.indices.getAlias({ index })).body;
      const current = Object.keys(aliases)[0];

      const allChange = removes.concat(fieldChanges);

      const reindexBody: estypes.ReindexRequest = {
        source: { index: current },
        dest: { index: next },
        script: {
          lang: 'painless',
          source: allChange.map(part => `ctx._source.remove("${part}");`).join(' ') // Removing
        },
        wait_for_completion: true
      };

      // Reindex
      await this.#client.reindex(reindexBody);

      await Promise.all(Object.keys(aliases)
        .map(alias => this.#client.indices.delete({ index: alias })));

      await this.#client.indices.putAlias({ index: next, name: index });
    } else { // Only update the schema
      const schema = ElasticsearchSchemaUtil.generateSchemaMapping(cls, this.config.schemaConfig);

      await this.#client.indices.putMapping({
        index,
        ...schema,
      });
    }
  }

  async createStorage(): Promise<void> {
    // Pre-create indexes if missing
    console.debug('Create Storage', { idx: this.getNamespacedIndex('*') });
    await this.computeAliasMappings(true);
  }

  async deleteStorage(): Promise<void> {
    console.debug('Deleting storage', { idx: this.getNamespacedIndex('*') });
    await this.#client.indices.delete({
      index: this.getNamespacedIndex('*')
    });
    await this.computeAliasMappings(true);
  }
}