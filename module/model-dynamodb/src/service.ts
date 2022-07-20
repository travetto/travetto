import * as dynamodb from '@aws-sdk/client-dynamodb';

import { Class, ShutdownManager, Util } from '@travetto/base';
import { DeepPartial } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import {
  ModelCrudSupport, ModelExpirySupport, ModelRegistry, ModelStorageSupport,
  ModelIndexedSupport, ModelType, NotFoundError, ExistsError,
  IndexNotSupported, OptionalId
} from '@travetto/model';

import { ModelCrudUtil } from '@travetto/model/src/internal/service/crud';
import { ModelExpiryUtil } from '@travetto/model/src/internal/service/expiry';
import { ModelIndexedUtil } from '@travetto/model/src/internal/service/indexed';
import { ModelStorageUtil } from '@travetto/model/src/internal/service/storage';

import { DynamoDBModelConfig } from './config';

const EXP_ATTR = 'expires_at__';

function simpleName(idx: string) {
  return idx.replace(/[^A-Za-z0-9]/g, '');
}

function toValue(val: string | number | boolean | Date | undefined | null, forceString?: boolean): dynamodb.AttributeValue;
function toValue(val: unknown, forceString?: boolean): dynamodb.AttributeValue | undefined {
  if (val === undefined || val === null || val === '') {
    return { NULL: true };
  } else if (typeof val === 'string' || forceString) {
    return { S: val as string };
  } else if (typeof val === 'number') {
    return { N: `${val}` };
  } else if (typeof val === 'boolean') {
    return { BOOL: val };
  } else if (val instanceof Date) {
    return { N: `${val.getTime()}` };
  }
}

async function loadAndCheckExpiry<T extends ModelType>(cls: Class<T>, doc: string): Promise<T> {
  const item = await ModelCrudUtil.load(cls, doc);
  if (ModelRegistry.get(cls).expiresAt) {
    const expiry = ModelExpiryUtil.getExpiryState(cls, item);
    if (!expiry.expired) {
      return item;
    }
  } else {
    return item;
  }
  throw new NotFoundError(cls, item.id);
}

/**
 * A model service backed by DynamoDB
 */
@Injectable()
export class DynamoDBModelService implements ModelCrudSupport, ModelExpirySupport, ModelStorageSupport, ModelIndexedSupport {

  client: dynamodb.DynamoDB;

  constructor(public readonly config: DynamoDBModelConfig) { }

  #resolveTable(cls: Class) {
    let table = ModelRegistry.getStore(cls).toLowerCase().replace(/[^A-Za-z0-9_]+/g, '_');
    if (this.config.namespace) {
      table = `${this.config.namespace}_${table}`;
    }
    return table;
  }

  async #putItem<T extends ModelType>(cls: Class<T>, id: string, item: T, mode: 'create' | 'update' | 'upsert') {
    const config = ModelRegistry.get(cls);
    let expiry: number | undefined;

    if (config.expiresAt) {
      const { expiresAt } = ModelExpiryUtil.getExpiryState(cls, item);
      if (expiresAt) {
        expiry = Math.trunc(Math.ceil(expiresAt.getTime() / 1000)); // Convert to seconds
      }
    }

    try {
      if (mode === 'create') {
        const indices: Record<string, unknown> = {};
        for (const idx of config.indices ?? []) {
          const { key, sort } = ModelIndexedUtil.computeIndexKey(cls, idx, item);
          const prop = simpleName(idx.name);
          indices[`${prop}__`] = toValue(key);
          if (sort) {
            indices[`${prop}_sort__`] = toValue(+sort);
          }
        }
        const query = {
          TableName: this.#resolveTable(cls),
          ConditionExpression: 'attribute_not_exists(body)',
          Item: {
            id: toValue(item.id),
            body: toValue(JSON.stringify(item)),
            ...(expiry !== undefined ? { [EXP_ATTR]: toValue(expiry) } : {}),
            ...indices
          },
          ReturnValues: 'NONE'
        };
        console.debug('Querying', { query } as unknown as Record<string, string>);
        return await this.client.putItem(query);
      } else {
        const indices: Record<string, unknown> = {};
        const expr: string[] = [];
        for (const idx of config.indices ?? []) {
          const { key, sort } = ModelIndexedUtil.computeIndexKey(cls, idx, item);
          const prop = simpleName(idx.name);
          indices[`:${prop}`] = toValue(key);
          expr.push(`${prop}__ = :${prop}`);
          if (sort) {
            indices[`:${prop}_sort`] = toValue(+sort);
            expr.push(`${prop}_sort__ = :${prop}_sort`);
          }
        }

        return await this.client.updateItem({
          TableName: this.#resolveTable(cls),
          ConditionExpression: mode === 'update' ? 'attribute_exists(body)' : undefined,
          Key: { id: { S: id } },
          UpdateExpression: `SET ${[
            'body=:body',
            expiry !== undefined ? `${EXP_ATTR}=:expr` : undefined,
            ...expr
          ].filter(x => !!x).join(', ')}`,
          ExpressionAttributeValues: {
            ':body': toValue(JSON.stringify(item)),
            ...(expiry !== undefined ? { ':expr': toValue(expiry) } : {}),
            ...indices
          },
          ReturnValues: 'ALL_NEW'
        });
      }
    } catch (err: any) {
      if (err.name === 'ConditionalCheckFailedException') {
        if (mode === 'create') {
          throw new ExistsError(cls, id);
        } else if (mode === 'update') {
          throw new NotFoundError(cls, id);
        }
      }
      throw err;
    }
  }

  #computeIndexConfig<T extends ModelType>(cls: Class<T>) {
    const config = ModelRegistry.get(cls);
    const attributes: dynamodb.AttributeDefinition[] = [];
    const indices: dynamodb.GlobalSecondaryIndex[] = [];

    for (const idx of config.indices ?? []) {
      const idxName = simpleName(idx.name);
      attributes.push({ AttributeName: `${idxName}__`, AttributeType: 'S' });

      const keys = [{
        AttributeName: `${idxName}__`,
        KeyType: 'HASH'
      }];

      if (idx.type === 'sorted') {
        keys.push({
          AttributeName: `${idxName}_sort__`,
          KeyType: 'RANGE'
        });
        attributes.push({ AttributeName: `${idxName}_sort__`, AttributeType: 'N' });
      }

      indices.push({
        IndexName: idxName,
        // ProvisionedThroughput: '',
        Projection: {
          ProjectionType: 'INCLUDE',
          NonKeyAttributes: ['body', 'id']
        },
        KeySchema: keys
      });
    }

    return { indices: indices.length ? indices : undefined, attributes };
  }

  async postConstruct() {
    this.client = new dynamodb.DynamoDB({ ...this.config.client });
    await ModelStorageUtil.registerModelChangeListener(this);
    ShutdownManager.onShutdown(this.constructor.ᚕid, () => this.client.destroy());
  }

  // Storage

  /**
   * Add a new model
   * @param cls
   */
  async createModel(cls: Class<ModelType>) {
    const table = this.#resolveTable(cls);
    const idx = this.#computeIndexConfig(cls);

    const existing = await this.client.describeTable({ TableName: table }).then(() => true, () => false);

    if (existing) {
      return;
    }

    await this.client.createTable({
      TableName: table,
      KeySchema: [{ KeyType: 'HASH', AttributeName: 'id' }],
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        ...idx.attributes
      ],
      GlobalSecondaryIndexes: idx.indices
    });

    if (ModelRegistry.get(cls).expiresAt) {
      await this.client.updateTimeToLive({
        TableName: table,
        TimeToLiveSpecification: { AttributeName: EXP_ATTR, Enabled: true }
      });
    }
  }

  /**
   * Remove a model
   * @param cls
   */
  async deleteModel(cls: Class<ModelType>) {
    const table = this.#resolveTable(cls);
    const { Table: verify } = (await this.client.describeTable({ TableName: table }).catch(err => ({ Table: undefined })));
    if (verify) {
      await this.client.deleteTable({ TableName: table });
    }
  }

  /**
   * When the model changes
   * @param cls
   */
  async changeModel(cls: Class<ModelType>) {
    const table = this.#resolveTable(cls);
    const idx = this.#computeIndexConfig(cls);
    // const existing = await this.cl.describeTable({ TableName: table });

    await this.client.updateTable({
      TableName: table,
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        ...idx.attributes
      ],
      // TODO: Fill out index computation
    });
  }

  async createStorage() {
    // Do nothing
  }

  async deleteStorage() {
    for (const model of ModelRegistry.getClasses()) {
      await this.client.deleteTable({
        TableName: this.#resolveTable(model)
      }).catch(err => { });
    }
  }

  // Crud
  uuid(): string {
    return Util.uuid();
  }

  async get<T extends ModelType>(cls: Class<T>, id: string) {
    const res = await this.client.getItem({
      TableName: this.#resolveTable(cls),
      Key: { id: toValue(id) }
    });

    if (res && res.Item && res.Item.body) {
      return loadAndCheckExpiry(cls, res.Item.body.S!);
    }
    throw new NotFoundError(cls, id);
  }

  async create<T extends ModelType>(cls: Class<T>, item: OptionalId<T>) {
    const prepped = await ModelCrudUtil.preStore(cls, item, this);
    await this.#putItem(cls, prepped.id, prepped, 'create');
    return prepped;
  }

  async update<T extends ModelType>(cls: Class<T>, item: T) {
    ModelCrudUtil.ensureNotSubType(cls);
    item = await ModelCrudUtil.preStore(cls, item, this);
    if (ModelRegistry.get(cls).expiresAt) {
      await this.get(cls, item.id);
    }
    await this.#putItem(cls, item.id, item, 'update');
    return item;
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>) {
    ModelCrudUtil.ensureNotSubType(cls);
    const prepped = await ModelCrudUtil.preStore(cls, item, this);
    await this.#putItem(cls, prepped.id, prepped, 'upsert');
    return prepped;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string) {
    ModelCrudUtil.ensureNotSubType(cls);
    const id = item.id;
    item = await ModelCrudUtil.naivePartialUpdate(cls, item, view, () => this.get(cls, id)) as T;
    await this.#putItem(cls, id, item as T, 'update');
    return item as T;
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    ModelCrudUtil.ensureNotSubType(cls);
    const res = await this.client.deleteItem({
      TableName: this.#resolveTable(cls),
      ReturnValues: 'ALL_OLD',
      Key: { id: { S: id } }
    });
    if (!res.Attributes) {
      throw new NotFoundError(cls, id);
    }
  }

  async * list<T extends ModelType>(cls: Class<T>) {
    let done = false;
    let token: Record<string, dynamodb.AttributeValue> | undefined;
    while (!done) {
      const batch = await this.client.scan({
        TableName: this.#resolveTable(cls),
        ExclusiveStartKey: token
      });

      if (batch.Count && batch.Items) {
        for (const el of batch.Items) {
          try {
            yield await loadAndCheckExpiry(cls, el.body.S!);
          } catch (err) {
            if (!(err instanceof NotFoundError)) {
              throw err;
            }
          }
        }
      }

      if (!batch.Count || !batch.LastEvaluatedKey) {
        done = true;
      } else {
        token = batch.LastEvaluatedKey;
      }
    }
  }

  // Expiry
  async deleteExpired<T extends ModelType>(cls: Class<T>) {
    return -1;
  }

  // Indexed
  async #getIdByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>) {
    ModelCrudUtil.ensureNotSubType(cls);

    const idxCfg = ModelRegistry.getIndex(cls, idx, ['sorted', 'unsorted']);

    const { key, sort } = ModelIndexedUtil.computeIndexKey(cls, idxCfg, body);

    if (idxCfg.type === 'sorted' && sort === undefined) {
      throw new IndexNotSupported(cls, idxCfg, 'Sorted indices require the sort field');
    }

    const idxName = simpleName(idx);

    const query = {
      TableName: this.#resolveTable(cls),
      IndexName: idxName,
      ProjectionExpression: 'id',
      KeyConditionExpression: [sort ? `${idxName}_sort__ = :${idxName}_sort` : '', `${idxName}__ = :${idxName}`].filter(x => !!x).join(' and '),
      ExpressionAttributeValues: {
        [`:${idxName}`]: toValue(key),
        ...(sort ? { [`:${idxName}_sort`]: toValue(+sort) } : {})
      }
    };

    const result = await this.client.query(query);

    if (result.Count && result.Items && result.Items[0]) {
      return result.Items[0].id.S!;
    }
    throw new NotFoundError(`${cls.name} Index=${idx}`, key);
  }

  // Indexed
  async getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>) {
    return this.get(cls, await this.#getIdByIndex(cls, idx, body));
  }

  async deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>) {
    return this.delete(cls, await this.#getIdByIndex(cls, idx, body));
  }

  upsertByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: OptionalId<T>): Promise<T> {
    return ModelIndexedUtil.naiveUpsert(this, cls, idx, body);
  }

  async * listByIndex<T extends ModelType>(cls: Class<T>, idx: string, body?: DeepPartial<T>) {
    ModelCrudUtil.ensureNotSubType(cls);

    const cfg = ModelRegistry.getIndex(cls, idx, ['sorted', 'unsorted']);
    const { key } = ModelIndexedUtil.computeIndexKey(cls, cfg, body, { emptySortValue: null });

    const idxName = simpleName(idx);

    let done = false;
    let token: Record<string, dynamodb.AttributeValue> | undefined;
    while (!done) {
      const batch = await this.client.query({
        TableName: this.#resolveTable(cls),
        IndexName: idxName,
        ProjectionExpression: 'body',
        KeyConditionExpression: `${idxName}__ = :${idxName}`,
        ExpressionAttributeValues: {
          [`:${idxName}`]: toValue(key)
        },
        ExclusiveStartKey: token
      });

      if (batch.Count && batch.Items) {
        for (const el of batch.Items) {
          try {
            yield await loadAndCheckExpiry(cls, el.body.S!);
          } catch (err) {
            if (!(err instanceof NotFoundError)) {
              throw err;
            }
          }
        }
      }

      if (!batch.Count || !batch.LastEvaluatedKey) {
        done = true;
      } else {
        token = batch.LastEvaluatedKey;
      }
    }
  }
}