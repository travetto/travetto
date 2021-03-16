import * as es from '@elastic/elasticsearch';
import { Reindex } from '@elastic/elasticsearch/api/requestParams';

import { Class } from '@travetto/base';
import { ModelRegistry, ModelType } from '@travetto/model';
import { ModelStorageSupport } from '@travetto/model/src/service/storage';
import { SchemaChange } from '@travetto/schema';

import { ElasticsearchModelConfig } from './config';
import { ElasticsearchSchemaUtil } from './internal/schema';
import { EsIdentity } from './internal/types';

/**
 * Manager for elasticsearch indices and schemas
 */
export class IndexManager implements ModelStorageSupport {

  private indexToAlias = new Map<string, string>();
  private aliasToIndex = new Map<string, string>();

  private identities = new Map<Class, EsIdentity>();

  constructor(public readonly config: ElasticsearchModelConfig, private client: es.Client) { }

  getStore(cls: Class) {
    return ModelRegistry.getStore(cls).toLowerCase().replace(/[^A-Za-z0-9_]+/g, '_');
  }

  /**
   * Get namespaced index
   * @param idx
   */
  getNamespacedIndex(idx: string) {
    if (this.config.namespace) {
      return `${this.config.namespace}_${idx}`;
    } else {
      return idx;
    }
  }

  /**
   * Build the elasticsearch identity set for a given class (index, type)
   */
  getIdentity<T extends ModelType>(cls: Class<T>): EsIdentity {
    if (!this.identities.has(cls)) {
      const col = this.getStore(cls);
      const index = this.getNamespacedIndex(col);
      this.identities.set(cls, ElasticsearchSchemaUtil.MAJOR_VER < 7 ? { index, type: '_doc' } : { index });
    }
    return { ...this.identities.get(cls)! };
  }

  /**
   * Build alias mappings from the current state in the database
   */
  async computeAliasMappings(force = false) {
    if (force || !this.indexToAlias.size) {
      const { body: aliases } = (await this.client.cat.aliases({
        format: 'json'
      })) as { body: { index: string, alias: string }[] };

      this.indexToAlias = new Map();
      this.aliasToIndex = new Map();
      for (const al of aliases) {
        this.indexToAlias.set(al.index, al.alias);
        this.aliasToIndex.set(al.alias, al.index);
      }
    }
  }

  /**
   * Create index for type
   * @param cls
   * @param alias
   */
  async createIndex(cls: Class, alias = true) {
    const schema = ElasticsearchSchemaUtil.generateSourceSchema(cls, this.config.schemaConfig);
    const ident = this.getIdentity(cls); // Already namespaced
    const concreteIndex = `${ident.index}_${Date.now()}`;
    try {
      await this.client.indices.create({
        index: concreteIndex,
        body: {
          mappings: ElasticsearchSchemaUtil.MAJOR_VER < 7 ? { [ident.type!]: schema } : schema,
          settings: this.config.indexCreate,
          ...(alias ? { aliases: { [ident.index]: {} } } : {})
        }
      });
      console.debug('Index created', { index: ident.index, concrete: concreteIndex });
      console.debug('Index Config', {
        mappings: ElasticsearchSchemaUtil.MAJOR_VER < 7 ? { [ident.type!]: schema } : schema,
        settings: this.config.indexCreate
      });
    } catch (e) {
      console.warn('Index already created', { index: ident.index, error: e });
    }
    return concreteIndex;
  }

  /**
   * Build an index if missing
   */
  async createIndexIfMissing(cls: Class) {
    cls = ModelRegistry.getBaseModel(cls);
    const ident = this.getIdentity(cls);
    try {
      await this.client.search(ident);
      console.debug('Index already exists, not creating', ident);
    } catch (err) {
      await this.createIndex(cls);
    }
  }

  async createModel(cls: Class<ModelType>) {
    await this.createIndexIfMissing(cls);
    await this.computeAliasMappings(true);
  }

  async exportModel(cls: Class<ModelType>) {
    const schema = ElasticsearchSchemaUtil.generateSourceSchema(cls, this.config.schemaConfig);
    const ident = this.getIdentity(cls); // Already namespaced
    return `curl -XPOST $ES_HOST/${ident.index} -d '${JSON.stringify({
      mappings: ElasticsearchSchemaUtil.MAJOR_VER < 7 ? { [ident.type!]: schema } : schema,
      settings: this.config.indexCreate
    })}'`;
  }

  async deleteModel(cls: Class<ModelType>) {
    const alias = this.getNamespacedIndex(this.getStore(cls));
    if (this.aliasToIndex.get(alias)) {
      await this.client.indices.delete({
        index: this.aliasToIndex.get(alias)!
      });
      await this.computeAliasMappings(true);
    }
  }

  /**
   * When the schema changes
   */
  async changeSchema(cls: Class, change: SchemaChange) {
    // Find which fields are gone
    const removes = change.subs.reduce((acc, v) => {
      acc.push(...v.fields
        .filter(ev => ev.type === 'removing')
        .map(ev => [...v.path.map(f => f.name), ev.prev!.name].join('.')));
      return acc;
    }, [] as string[]);

    // Find which types have changed
    const typeChanges = change.subs.reduce((acc, v) => {
      acc.push(...v.fields
        .filter(ev => ev.type === 'changed')
        .map(ev => [...v.path.map(f => f.name), ev.prev!.name].join('.')));
      return acc;
    }, [] as string[]);

    const { index, type } = this.getIdentity(cls);

    // If removing fields or changing types, run as script to update data
    if (removes.length || typeChanges.length) { // Removing and adding
      const next = await this.createIndex(cls, false);

      const aliases = (await this.client.indices.getAlias({ index })).body;
      const curr = Object.keys(aliases)[0];

      const allChange = removes.concat(typeChanges);

      // Reindex
      await this.client.reindex({
        body: {
          source: { index: curr },
          dest: { index: next },
          script: {
            lang: 'painless',
            source: allChange.map(x => `ctx._source.remove("${x}");`).join(' ') // Removing
          }
        },
        waitForCompletion: true
      } as Reindex);

      await Promise.all(Object.keys(aliases)
        .map(x => this.client.indices.delete({ index: x })));

      await this.client.indices.putAlias({ index: next, name: index });
    } else { // Only update the schema
      const schema = ElasticsearchSchemaUtil.generateSourceSchema(cls, this.config.schemaConfig);

      await this.client.indices.putMapping({
        index,
        type,
        body: schema
      });
    }
  }

  async createStorage() {
    // PreCreate indexes if missing
    console.debug('Create Storage', { autoCreate: this.config.autoCreate, idx: this.getNamespacedIndex('*') });
    await this.computeAliasMappings(true);
  }

  async deleteStorage() {
    console.debug('Deleting storage', { idx: this.getNamespacedIndex('*') });
    await this.client.indices.delete({
      index: this.getNamespacedIndex('*')
    });
    await this.computeAliasMappings(true);
  }
}