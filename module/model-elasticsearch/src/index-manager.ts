import { Client, estypes } from '@elastic/elasticsearch';

import { Class } from '@travetto/runtime';
import { ModelRegistry, ModelType } from '@travetto/model';
import { ModelStorageSupport } from '@travetto/model/src/service/storage';
import { SchemaChange } from '@travetto/schema';

import { ElasticsearchModelConfig } from './config';
import { ElasticsearchSchemaUtil } from './internal/schema';

/**
 * Manager for elasticsearch indices and schemas
 */
export class IndexManager implements ModelStorageSupport {

  #indexToAlias = new Map<string, string>();
  #aliasToIndex = new Map<string, string>();
  #identities = new Map<Class, { index: string }>();
  #client: Client;

  constructor(public readonly config: ElasticsearchModelConfig, client: Client) {
    this.#client = client;
  }

  getStore(cls: Class): string {
    return ModelRegistry.getStore(cls).toLowerCase().replace(/[^A-Za-z0-9_]+/g, '_');
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
    const ident = this.getIdentity(cls); // Already namespaced
    const concreteIndex = `${ident.index}_${Date.now()}`;
    try {
      await this.#client.indices.create({
        index: concreteIndex,
        mappings: mapping,
        settings: this.config.indexCreate,
        ...(alias ? { aliases: { [ident.index]: {} } } : {})
      });
      console.debug('Index created', { index: ident.index, concrete: concreteIndex });
      console.debug('Index Config', {
        mappings: mapping,
        settings: this.config.indexCreate
      });
    } catch (err) {
      console.warn('Index already created', { index: ident.index, error: err });
    }
    return concreteIndex;
  }

  /**
   * Build an index if missing
   */
  async createIndexIfMissing(cls: Class): Promise<void> {
    cls = ModelRegistry.getBaseModel(cls);
    const ident = this.getIdentity(cls);
    try {
      await this.#client.search(ident);
      console.debug('Index already exists, not creating', ident);
    } catch {
      await this.createIndex(cls);
    }
  }

  async createModel(cls: Class<ModelType>): Promise<void> {
    await this.createIndexIfMissing(cls);
    await this.computeAliasMappings(true);
  }

  async exportModel(cls: Class<ModelType>): Promise<string> {
    const schema = ElasticsearchSchemaUtil.generateSchemaMapping(cls, this.config.schemaConfig);
    const ident = this.getIdentity(cls); // Already namespaced
    return `curl -XPOST $ES_HOST/${ident.index} -d '${JSON.stringify({
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
  async changeSchema(cls: Class, change: SchemaChange): Promise<void> {
    // Find which fields are gone
    const removes = change.subs.reduce<string[]>((acc, v) => {
      acc.push(...v.fields
        .filter(ev => ev.type === 'removing')
        .map(ev => [...v.path.map(f => f.name), ev.prev!.name].join('.')));
      return acc;
    }, []);

    // Find which types have changed
    const fieldChanges = change.subs.reduce<string[]>((acc, v) => {
      acc.push(...v.fields
        .filter(ev => ev.type === 'changed')
        .filter(ev => ev.prev?.type !== ev.curr?.type)
        .map(ev => [...v.path.map(f => f.name), ev.prev!.name].join('.')));
      return acc;
    }, []);

    const { index } = this.getIdentity(cls);

    // If removing fields or changing types, run as script to update data
    if (removes.length || fieldChanges.length) { // Removing and adding
      const next = await this.createIndex(cls, false);

      const aliases = (await this.#client.indices.getAlias({ index })).body;
      const curr = Object.keys(aliases)[0];

      const allChange = removes.concat(fieldChanges);

      const reindexBody: estypes.ReindexRequest = {
        source: { index: curr },
        dest: { index: next },
        script: {
          lang: 'painless',
          source: allChange.map(x => `ctx._source.remove("${x}");`).join(' ') // Removing
        },
        wait_for_completion: true
      };

      // Reindex
      await this.#client.reindex(reindexBody);

      await Promise.all(Object.keys(aliases)
        .map(x => this.#client.indices.delete({ index: x })));

      await this.#client.indices.putAlias({ index: next, name: index });
    } else { // Only update the schema
      const schema = ElasticsearchSchemaUtil.generateSchemaMapping(cls, this.config.schemaConfig);

      await this.#client.indices.putMapping({
        index,
        body: schema
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