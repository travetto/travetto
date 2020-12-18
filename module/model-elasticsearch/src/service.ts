import * as es from '@elastic/elasticsearch';
import { Index, Update } from '@elastic/elasticsearch/api/requestParams';

import {
  ModelCrudSupport, BulkOp, BulkResponse, ModelBulkSupport,
  ModelIndexedSupport, ModelType, ModelStorageSupport, NotFoundError
} from '@travetto/model-core';
import { ModelCrudUtil } from '@travetto/model-core/src/internal/service/crud';
import { ModelIndexedUtil } from '@travetto/model-core/src/internal/service/indexed';
import { ModelStorageUtil } from '@travetto/model-core/src/internal/service/storage';
import { Class, ChangeEvent } from '@travetto/registry';
import { Util, ShutdownManager } from '@travetto/base';
import { Injectable } from '@travetto/di';
import { SchemaChangeEvent } from '@travetto/schema';

import { ElasticsearchModelConfig } from './config';
import { EsIdentity, EsBulkError } from './internal/types';
import { ElasticsearchQueryUtil } from './internal/query';
import { ElasticsearchSchemaUtil } from './internal/schema';
import { IndexManager } from './index-manager';
import { SearchResponse } from './types';

/**
 * Convert _id to id
 */
function postLoad<T extends ModelType>(o: T) {
  if ('_id' in o) {
    o.id = (o as any)['_id'];
    delete (o as any)['_id'];
  }
  return o;
}

/**
 * Elasticsearch model source.
 */
@Injectable()
export class ElasticsearchModelService implements ModelCrudSupport, ModelIndexedSupport, ModelStorageSupport, ModelBulkSupport {

  client: es.Client;
  manager: IndexManager;

  constructor(private config: ElasticsearchModelConfig) { }

  async postConstruct() {
    this.client = new es.Client({
      nodes: this.config.hosts,
      ...(this.config.options || {})
    });
    await this.client.cluster.health({});
    ModelStorageUtil.registerModelChangeListener(this);
    this.manager = new IndexManager(this.config, this.client);
    ShutdownManager.onShutdown(__filename, () => this.client.close());
  }

  uuid() {
    return Util.uuid();
  }

  async onModelSchemaChange(e: SchemaChangeEvent) {
    await this.manager.onSchemaChange(e);
  }

  async onModelVisibilityChange<T extends ModelType>(e: ChangeEvent<Class<T>>) {
    await this.manager.onModelChange(e);
  }

  async createStorage() {
    await this.manager.createStorage();
  }

  async deleteStorage() {
    await this.manager.deleteStorage();
  }

  async get<T extends ModelType>(cls: Class<T>, id: string) {
    try {
      const res = await this.client.get({ ...this.manager.getIdentity(cls), id });
      return postLoad(await ModelCrudUtil.load(cls, res.body._source));
    } catch (err) {
      throw new NotFoundError(cls, id);
    }
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    const { body: res } = await this.client.delete({
      ...this.manager.getIdentity(cls) as Required<EsIdentity>,
      id,
      refresh: 'true'
    });
    if (!res.found) {
      throw new NotFoundError(cls, id);
    }
  }

  async create<T extends ModelType>(cls: Class<T>, o: T): Promise<T> {
    o = await ModelCrudUtil.preStore(cls, o, this);
    const id = o.id!;

    const { body: res } = await this.client.index({
      ...this.manager.getIdentity(cls) as Required<EsIdentity>,
      ... (id ? { id } : {}),
      refresh: 'true',
      body: o
    });

    o.id = res._id;
    return o;
  }

  async update<T extends ModelType>(cls: Class<T>, o: T): Promise<T> {
    o = await ModelCrudUtil.preStore(cls, o, this);

    const id = o.id!;

    await this.client.index({
      ...this.manager.getIdentity(cls),
      id,
      opType: 'index',
      refresh: 'true',
      body: o
    } as Index);

    o.id = id;
    return o;
  }

  async upsert<T extends ModelType>(cls: Class<T>, o: T) {
    o = await ModelCrudUtil.preStore(cls, o, this);

    const id = o.id!;

    await this.client.update({
      ...this.manager.getIdentity(cls),
      id,
      refresh: 'true',
      body: {
        doc: o,
        doc_as_upsert: true
      }
    });

    o.id = id;
    return o;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, id: string, data: Partial<T>) {
    const script = ElasticsearchSchemaUtil.generateUpdateScript(data);

    console.debug('Partial Script', { script });

    await this.client.update({
      ...this.manager.getIdentity(cls),
      id,
      refresh: 'true',
      body: {
        script
      }
    } as Update);

    return this.get(cls, id);
  }

  async * list<T extends ModelType>(cls: Class<T>) {
    let search: SearchResponse<T> = await this.client.search({
      ...this.manager.getIdentity(cls),
      scroll: '2m',
      size: 100,
      body: {
        query: { match_all: {} }
      }
    });

    while (search.body.hits.hits.length > 0) {
      for (const el of search.body.hits.hits) {
        try {
          yield postLoad(await ModelCrudUtil.load(cls, el._source));
        } catch (err) {
          if (!(err instanceof NotFoundError)) {
            throw err;
          }
        }
        search = await this.client.scroll({
          scroll_id: search.body._scroll_id,
          scroll: '2m'
        });
      }
    }
  }

  async processBulk<T extends ModelType>(cls: Class<T>, operations: BulkOp<T>[]) {

    // Pre store
    for (const el of operations) {
      if ('insert' in el && el.insert) {
        el.insert = await ModelCrudUtil.preStore(cls, el.insert, this);
      } else if ('update' in el && el.update) {
        el.update = await ModelCrudUtil.preStore(cls, el.update, this);
      } else if ('upsert' in el && el.upsert) {
        el.upsert = await ModelCrudUtil.preStore(cls, el.upsert, this);
      }
    }

    const body = operations.reduce((acc, op) => {

      const esIdent = this.manager.getIdentity((op.upsert ?? op.delete ?? op.insert ?? op.update ?? { constructor: cls }).constructor as Class);
      const ident = ElasticsearchSchemaUtil.MAJOR_VER < 7 ?
        { _index: esIdent.index, _type: esIdent.type } :
        { _index: esIdent.index };

      if (op.delete) {
        acc.push({ ['delete']: { ...ident, _id: op.delete.id } });
      } else if (op.insert) {
        acc.push({ create: { ...ident, _id: op.insert.id } }, op.insert);
        delete op.insert.id;
      } else if (op.upsert) {
        acc.push({ index: { ...ident, _id: op.upsert.id } }, op.upsert);
        delete op.upsert.id;
      } else if (op.update) {
        acc.push({ update: { ...ident, _id: op.update.id } }, { doc: op.update });
        delete op.update.id;
      }
      return acc;
    }, [] as Record<string, any>[]);

    const { body: res } = await this.client.bulk({
      body,
      refresh: 'true'
    });

    const out: BulkResponse = {
      counts: {
        delete: 0,
        insert: 0,
        upsert: 0,
        update: 0,
        error: 0
      },
      insertedIds: new Map(),
      errors: [] as EsBulkError[]
    };

    type Count = keyof typeof out['counts'];

    for (let i = 0; i < res.items.length; i++) {
      const item = res.items[i];
      const [k] = Object.keys(item) as (Count | 'create' | 'index')[];
      const v = item[k]!;
      if (v.error) {
        out.errors.push(v.error);
        out.counts.error += 1;
      } else {
        let sk: Count;
        if (k === 'create') {
          sk = 'insert';
        } else if (k === 'index') {
          sk = operations[i].insert ? 'insert' : 'upsert';
        } else {
          sk = k;
        }

        if (v.result === 'created') {
          out.insertedIds.set(i, v._id);
          (operations[i].insert ?? operations[i].upsert)!.id = v._id;
        }

        out.counts[sk] += 1;
      }
    }

    return out;
  }

  // Indexed
  async getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>) {
    const res: SearchResponse<T> = await this.client.search({
      index: this.manager.getIdentity(cls).index,
      body: {
        query: ElasticsearchQueryUtil.extractWhereTermQuery(ModelIndexedUtil.projectIndex(cls, idx, body, null), cls)
      }
    });
    if (!res.body.hits.hits.length) {
      throw new NotFoundError(`${cls.name}: ${idx}`, ModelIndexedUtil.computeIndexKey(cls, idx, body));
    }
    return postLoad(await ModelCrudUtil.load(cls, res.body.hits.hits[0]._source));
  }

  async deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>) {
    const res = await this.client.deleteByQuery({
      index: this.manager.getIdentity(cls).index,
      body: {
        query: ElasticsearchQueryUtil.extractWhereTermQuery(ModelIndexedUtil.projectIndex(cls, idx, body, null), cls)
      }
    });
    if (res.body.deleted) {
      return;
    }
    throw new NotFoundError(`${cls.name}: ${idx}`, ModelIndexedUtil.computeIndexKey(cls, idx, body));
  }
}