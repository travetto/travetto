import * as es from '@elastic/elasticsearch';
import { Reindex } from '@elastic/elasticsearch/api/requestParams';

import { ModelRegistry, ModelType } from '@travetto/model-core';
import { ChangeEvent, Class } from '@travetto/registry';
import { SchemaChangeEvent } from '@travetto/schema';
import { ElasticsearchModelConfig } from './config';
import { ElasticsearchSchemaUtil } from './internal/schema';
import { EsIdentity } from './internal/types';

/**
 * Manager for elasticsearch indices and schemas
 */
export class IndexManager {

  private indexToAlias = new Map<string, string>();
  private aliasToIndex = new Map<string, string>();

  private identities = new Map<Class, EsIdentity>();

  constructor(private config: ElasticsearchModelConfig, private client: es.Client) { }

  getStore(cls: Class) {
    return ModelRegistry.getStore(cls)!;
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
          settings: this.config.indexCreate
        },
        ...(alias ? { aliases: { [ident.index]: {} } } : {})
      });
      console.debug('Index created', { index: ident.index });
      console.debug('Index Config', {
        mappings: ElasticsearchSchemaUtil.MAJOR_VER < 7 ? { [ident.type!]: schema } : schema,
        settings: this.config.indexCreate
      });
    } catch (e) {
      console.debug('Index already created', { index: ident.index });
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
    } catch (err) {
      await this.createIndex(cls);
    }
  }

  /**
   * When the model changes
   */
  async onModelChange(e: ChangeEvent<Class>) {
    console.debug('Model Changed', { type: e.type, target: (e.curr ?? e.prev)?.ᚕid });

    if (!this.config.autoCreate) {
      return;
    }

    const cls = e.curr ?? e.prev!;
    if (ModelRegistry.getBaseModel(cls) !== cls) {
      return; // Skip it
    }

    switch (e.type) {
      case 'removing': {
        const alias = this.getNamespacedIndex(this.getStore(e.prev!));
        if (this.aliasToIndex.get(alias)) {
          await this.client.indices.delete({
            index: this.aliasToIndex.get(alias)!
          });
          await this.computeAliasMappings(true);
        }
        break;
      }
      case 'added': {
        await this.createIndexIfMissing(e.curr!);
        await this.computeAliasMappings(true);
        break;
      }
    }
  }

  /**
   * When the schema changes
   */
  async onSchemaChange(e: SchemaChangeEvent) {
    // Find which fields are gone
    const removes = e.change.subs.reduce((acc, v) => {
      acc.push(...v.fields
        .filter(ev => ev.type === 'removing')
        .map(ev => [...v.path.map(f => f.name), ev.prev!.name].join('.')));
      return acc;
    }, [] as string[]);

    // Find which types have changed
    const typeChanges = e.change.subs.reduce((acc, v) => {
      acc.push(...v.fields
        .filter(ev => ev.type === 'changed')
        .map(ev => [...v.path.map(f => f.name), ev.prev!.name].join('.')));
      return acc;
    }, [] as string[]);

    const { index, type } = this.getIdentity(e.cls);

    // If removing fields or changing types, run as script to update data
    if (removes.length || typeChanges.length) { // Removing and adding
      const next = await this.createIndex(e.cls, false);

      const aliases = await this.client.indices.getAlias({ index });
      const curr = Object.keys(aliases)[0];

      const allChange = removes.concat(typeChanges);

      // Reindex
      await this.client.reindex({
        body: {
          source: { index: curr },
          dest: { index: next },
          script: {
            lang: 'painless',
            inline: allChange.map(x => `ctx._source.remove("${x}");`).join(' ') // Removing
          }
        },
        waitForCompletion: true
      } as Reindex);

      await Promise.all(Object.keys(aliases)
        .map(x => this.client.indices.delete({ index: x })));

      await this.client.indices.putAlias({ index: next, name: index });
    } else { // Only update the schema
      const schema = ElasticsearchSchemaUtil.generateSourceSchema(e.cls, this.config.schemaConfig);

      await this.client.indices.putMapping({
        index,
        type,
        body: schema
      });
    }
  }

  async createStorage() {
    // PreCreate indexes if missing
    console.debug('Create Storage', { autoCreate: this.config.autoCreate });
    await this.computeAliasMappings(true);
  }

  async deleteStorage() {
    await this.client.indices.delete({
      index: this.getNamespacedIndex('*'),
    });
  }
}