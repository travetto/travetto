import * as dynamodb from '@aws-sdk/client-dynamodb';

import { Class, ShutdownManager, Util } from '@travetto/base';
import { Injectable } from '@travetto/di';
import {
  ModelCrudSupport, ModelExpirySupport, ModelRegistry, ModelStorageSupport,
  ModelIndexedSupport, ModelType, NotFoundError, ExistsError, SubTypeNotSupportedError
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
    let expiry: number | undefined;

    if (config.expiresAt) {
      const { expiresAt } = ModelExpiryUtil.getExpiryState(cls, item);
      if (expiresAt) {
        expiry = Math.trunc(Math.ceil(expiresAt.getTime() / 1000)); // Convert to seconds
      }
    }

    try {
      if (mode === 'create') {
        const query = {
          TableName: this.resolveTable(cls),
          ConditionExpression: 'attribute_not_exists(body)',
          Item: {
            id: toValue(item.id),
            body: toValue(JSON.stringify(item)),
            ...(expiry !== undefined ? { [EXP_ATTR]: toValue(expiry) } : {}),
            ...Object.fromEntries(config.indices?.map(idx => [`${simpleName(idx.name)}__`, toValue(ModelIndexedUtil.computeIndexKey(cls, idx, item))]) ?? [])
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
          UpdateExpression: `SET ${[
            'body=:body',
            expiry !== undefined ? `${EXP_ATTR}=:expr` : undefined,
            ...(config.indices?.map(idx => `${simpleName(idx.name)}__ = :${simpleName(idx.name)}`) ?? [])
          ].filter(x => !!x).join(', ')}`,
          ExpressionAttributeValues: {
            ':body': toValue(JSON.stringify(item)),
            ...(expiry !== undefined ? { ':expr': toValue(expiry) } : {}),
            ...Object.fromEntries(config.indices?.map(idx => [`:${simpleName(idx.name)}`, toValue(ModelIndexedUtil.computeIndexKey(cls, idx, item))]) ?? [])
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
    const attributes = config.indices?.flatMap(idx => ({ AttributeName: `${simpleName(idx.name)}__`, AttributeType: 'S' })) ?? [];

    const indices: dynamodb.GlobalSecondaryIndex[] | undefined = config.indices?.map(idx => ({
      IndexName: simpleName(idx.name),
      Projection: {
        ProjectionType: 'INCLUDE',
        NonKeyAttributes: ['id']
      },
      KeySchema: [{
        AttributeName: `${simpleName(idx.name)}__`,
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

    const existing = await this.cl.describeTable({ TableName: table }).then(() => true, () => false);

    if (existing) {
      return;
    }

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

    if (ModelRegistry.get(cls).expiresAt) {
      await this.cl.updateTimeToLive({
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
      return loadAndCheckExpiry(cls, res.Item.body.S!);
    }
    throw new NotFoundError(cls, id);
  }

  async create<T extends ModelType>(cls: Class<T>, item: T) {
    item = await ModelCrudUtil.preStore(cls, item, this);
    await this.putItem(cls, item.id, item, 'create');
    return item;
  }

  async update<T extends ModelType>(cls: Class<T>, item: T) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }
    item = await ModelCrudUtil.preStore(cls, item, this);
    if (ModelRegistry.get(cls).expiresAt) {
      await this.get(cls, item.id);
    }
    await this.putItem(cls, item.id, item, 'update');
    return item;
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: T) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }
    item = await ModelCrudUtil.preStore(cls, item, this);
    await this.putItem(cls, item.id, item, 'upsert');
    return item;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }
    const id = item.id;
    item = await ModelCrudUtil.naivePartialUpdate(cls, item, view, () => this.get(cls, id)) as T;
    await this.putItem(cls, id, item as T, 'update');
    return item as T;
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }
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
            yield await loadAndCheckExpiry(cls, el.body.S!);
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
  async deleteExpired<T extends ModelType>(cls: Class<T>) {
    return -1;
  }

  // Indexed
  async getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }

    const query = {
      TableName: this.resolveTable(cls),
      IndexName: simpleName(idx),
      ProjectionExpression: 'id',
      KeyConditionExpression: `${simpleName(idx)}__ = :${simpleName(idx)}`,
      ExpressionAttributeValues: {
        [`:${simpleName(idx)}`]: toValue(ModelIndexedUtil.computeIndexKey(cls, idx, body))
      }
    };

    const result = await this.cl.query(query);

    if (result.Count && result.Items && result.Items[0]) {
      return this.get(cls, result.Items[0].id.S!);
    }
    throw new NotFoundError(`${cls.name} Index=${idx}`, ModelIndexedUtil.computeIndexKey(cls, idx, body, '; '));
  }

  async deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }

    const query = {
      TableName: this.resolveTable(cls),
      IndexName: simpleName(idx),
      ProjectionExpression: 'id',
      KeyConditionExpression: `${simpleName(idx)}__ = :${simpleName(idx)}`,
      ExpressionAttributeValues: {
        [`:${simpleName(idx)}`]: toValue(ModelIndexedUtil.computeIndexKey(cls, idx, body))
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