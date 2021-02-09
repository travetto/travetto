import * as dynamodb from '@aws-sdk/client-dynamodb';

import { Class, ShutdownManager, Util } from '@travetto/base';
import { Injectable } from '@travetto/di';
import {
  ModelCrudSupport, ModelExpirySupport, ModelRegistry, ModelStorageSupport,
  ModelIndexedSupport, ModelType, NotFoundError, ExistsError
} from '@travetto/model';

import { ModelCrudUtil } from '@travetto/model/src/internal/service/crud';
import { ModelExpiryUtil } from '@travetto/model/src/internal/service/expiry';
import { ModelIndexedUtil } from '@travetto/model/src/internal/service/indexed';
import { ModelStorageUtil } from '@travetto/model/src/internal/service/storage';

import { DynamoDBModelConfig } from './config';

interface Expirable {
  _expiresAt: number;
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

/**
 * A model service backed by DynamoDB
 */
@Injectable()
export class DynamoDBModelService implements ModelCrudSupport, ModelExpirySupport, ModelStorageSupport, ModelIndexedSupport {

  cl: dynamodb.DynamoDB;

  constructor(public readonly config: DynamoDBModelConfig) { }

  private resolveTable(cls: Class) {
    let table = ModelRegistry.getStore(cls).toLowerCase().replace(/[^A-Za-z0-9_]+/g, '_');
    if (this.config.namespace) {
      table = `${this.config.namespace}_${table}`;
    }
    return table;
  }

  private async putItem<T extends ModelType>(cls: Class<T>, id: string, item: T, mode: 'create' | 'update' | 'upsert') {
    const config = ModelRegistry.get(cls);
    try {
      if (mode === 'create') {
        const query = {
          TableName: this.resolveTable(cls),
          ConditionExpression: 'attribute_not_exists(body)',
          Item: {
            id: toValue(item.id),
            body: toValue(JSON.stringify(item)),
            ...Object.fromEntries(config.indices?.map(idx => [`${idx.name}__`, toValue(ModelIndexedUtil.computeIndexKey(cls, idx, item))]) ?? [])
          },
          ReturnValues: 'NONE'
        };
        console.debug('Querying', { query } as unknown as Record<string, string>);
        return await this.cl.putItem(query);
      } else {
        return await this.cl.updateItem({
          TableName: this.resolveTable(cls),
          ConditionExpression: mode === 'update' ? 'attribute_exists(body)' : undefined,
          Key: { id: { S: id } },
          UpdateExpression: `SET ${['body=:body', ...(config.indices?.map(idx => `${idx.name}__ = :${idx.name}`) ?? [])].join(', ')}`,
          ExpressionAttributeValues: {
            ':body': toValue(JSON.stringify(item)),
            ...Object.fromEntries(config.indices?.map(idx => [`:${idx.name}`, toValue(ModelIndexedUtil.computeIndexKey(cls, idx, item))]) ?? [])
          },
          ReturnValues: 'ALL_NEW'
        });
      }
    } catch (err) {
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

  private computeIndexConfig<T extends ModelType>(cls: Class<T>) {
    const config = ModelRegistry.get(cls);
    const attributes = config.indices?.flatMap(idx => ({ AttributeName: `${idx.name}__`, AttributeType: 'S' })) ?? [];

    const indices: dynamodb.GlobalSecondaryIndex[] | undefined = config.indices?.map(idx => ({
      IndexName: idx.name,
      Projection: {
        ProjectionType: 'INCLUDE',
        NonKeyAttributes: ['id']
      },
      KeySchema: [{
        AttributeName: `${idx.name}__`,
        KeyType: 'HASH'
      }]
    }));

    return { indices, attributes };
  }

  async postConstruct() {
    this.cl = new dynamodb.DynamoDB({ ...this.config.config });
    ModelStorageUtil.registerModelChangeListener(this);
    ShutdownManager.onShutdown(this.constructor.ᚕid, () => this.cl.destroy());
  }

  // Storage

  /**
   * Add a new model
   * @param cls
   */
  async createModel(cls: Class<ModelType>) {
    const table = this.resolveTable(cls);
    const idx = this.computeIndexConfig(cls);

    await this.cl.createTable({
      TableName: table,
      KeySchema: [{ KeyType: 'HASH', AttributeName: 'id' }],
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        ...idx.attributes
      ],
      GlobalSecondaryIndexes: idx.indices?.length ? idx.indices : undefined
    });

    if (ModelRegistry.get(cls).expiry) {
      await this.cl.updateTimeToLive({
        TableName: table,
        TimeToLiveSpecification: { AttributeName: '_expiresAt', Enabled: true }
      });
    }
  }

  /**
   * Remove a model
   * @param cls
   */
  async deleteModel(cls: Class<ModelType>) {
    const table = this.resolveTable(cls);
    const { Table: verify } = (await this.cl.describeTable({ TableName: table }).catch(err => ({ Table: undefined })));
    if (verify) {
      await this.cl.deleteTable({ TableName: table });
    }
  }

  /**
   * When the model changes
   * @param cls
   */
  async changeModel(cls: Class<ModelType>) {
    const table = this.resolveTable(cls);
    const idx = this.computeIndexConfig(cls);
    // const existing = await this.cl.describeTable({ TableName: table });

    await this.cl.updateTable({
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
      await this.cl.deleteTable({
        TableName: this.resolveTable(model)
      }).catch(err => { });
    }
  }

  // Crud
  uuid(): string {
    return Util.uuid();
  }

  async get<T extends ModelType>(cls: Class<T>, id: string) {
    const res = await this.cl.getItem({
      TableName: this.resolveTable(cls),
      Key: { id: toValue(id) }
    });

    if (res && res.Item && res.Item.body) {
      return await ModelCrudUtil.load(cls, res.Item.body.S!);
    }
    throw new NotFoundError(cls, id);
  }

  async create<T extends ModelType>(cls: Class<T>, item: T) {
    item = await ModelCrudUtil.preStore(cls, item, this);
    await this.putItem(cls, item.id!, item, 'create');
    return item;
  }

  async update<T extends ModelType>(cls: Class<T>, item: T) {
    item = await ModelCrudUtil.preStore(cls, item, this);
    await this.putItem(cls, item.id!, item, 'update');
    return item;
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: T) {
    item = await ModelCrudUtil.preStore(cls, item, this);
    await this.putItem(cls, item.id!, item, 'upsert');
    return item;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, id: string, item: Partial<T>, view?: string) {
    item = await ModelCrudUtil.naivePartialUpdate(cls, item, view, () => this.get(cls, id)) as T;
    await this.putItem(cls, item.id!, item, 'update');
    return item as T;
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    const res = await this.cl.deleteItem({
      TableName: this.resolveTable(cls),
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
      const batch = await this.cl.scan({
        TableName: this.resolveTable(cls),
        ExclusiveStartKey: token
      });

      if (batch.Count && batch.Items) {
        for (const el of batch.Items) {
          try {
            yield await ModelCrudUtil.load(cls, el.body.S!);
          } catch (e) {
            if (!(e instanceof NotFoundError)) {
              throw e;
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
  async updateExpiry<T extends ModelType>(cls: Class<T>, id: string, ttl: number) {
    const item = ModelExpiryUtil.getPartialUpdate(cls, {}, ttl);
    const expiry = ModelExpiryUtil.getExpiryForItem(cls, item);
    (item as unknown as Expirable)._expiresAt = expiry.expiresAt.getTime() / 1000; // Convert to seconds
    await this.updatePartial(cls, id, item);
  }

  async getExpiry<T extends ModelType>(cls: Class<T>, id: string) {
    const item = await this.get(cls, id);
    return ModelExpiryUtil.getExpiryForItem(cls, item);
  }

  async upsertWithExpiry<T extends ModelType>(cls: Class<T>, item: T, ttl: number) {
    item = ModelExpiryUtil.getPartialUpdate(cls, item, ttl);
    const expiry = ModelExpiryUtil.getExpiryForItem(cls, item);
    (item as unknown as Expirable)._expiresAt = expiry.expiresAt.getTime() / 1000; // Convert to seconds
    return await this.upsert(cls, item);
  }

  // Indexed
  async getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>) {
    const query = {
      TableName: this.resolveTable(cls),
      IndexName: idx,
      ProjectionExpression: 'id',
      KeyConditionExpression: `${idx}__ = :${idx}`,
      ExpressionAttributeValues: {
        [`:${idx}`]: toValue(ModelIndexedUtil.computeIndexKey(cls, idx, body))
      }
    };

    const result = await this.cl.query(query);

    if (result.Count && result.Items && result.Items[0]) {
      return this.get(cls, result.Items[0].id.S!);
    }
    throw new NotFoundError(`${cls.name} Index=${idx}`, ModelIndexedUtil.computeIndexKey(cls, idx, body, '; '));
  }

  async deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>) {
    const query = {
      TableName: this.resolveTable(cls),
      IndexName: idx,
      ProjectionExpression: 'id',
      KeyConditionExpression: `${idx}__ = :${idx}`,
      ExpressionAttributeValues: {
        [`:${idx}`]: toValue(ModelIndexedUtil.computeIndexKey(cls, idx, body))
      }
    };

    const result = await this.cl.query(query);

    if (result.Count && result.Items && result.Items[0]) {
      await this.delete(cls, result.Items[0].id.S!);
      return;
    }
    throw new NotFoundError(`${cls.name} Index=${idx}`, ModelIndexedUtil.computeIndexKey(cls, idx, body, '; '));
  }
}