import * as dynamodb from '@aws-sdk/client-dynamodb';

import { AppError, ShutdownManager, Util } from '@travetto/base';
import { Injectable } from '@travetto/di';
import { ChangeEvent, Class } from '@travetto/registry';
import {
  ModelCrudSupport, ModelExpirySupport, ModelRegistry, ModelStorageSupport,
  ModelIndexedSupport, ModelType, NotFoundError, ExistsError, IndexConfig
} from '@travetto/model-core';

import { ModelCrudUtil } from '@travetto/model-core/src/internal/service/crud';
import { ModelExpiryUtil } from '@travetto/model-core/src/internal/service/expiry';
import { ModelIndexedUtil } from '@travetto/model-core/src/internal/service/indexed';

import { DynamoDBModelConfig } from './config';

/* eslint-disable no-redeclare */
function toValue(val: string | number | boolean | Date | undefined | null): dynamodb.AttributeValue;
function toValue(val: any): dynamodb.AttributeValue | undefined {
  if (val === undefined || val === null || val === '') {
    return { NULL: true };
  } else if (typeof val === 'string') {
    return { S: val };
  } else if (typeof val === 'number') {
    return { N: `${val}` };
  } else if (typeof val === 'boolean') {
    return { BOOL: val };
  } else if (val instanceof Date) {
    return { N: `${val.getTime()}` };
  }
}
/* eslint-enable no-redeclare */

function toEntries<T>(item: T) {
  return Object.entries(item)
    .filter(([k, v]) => k !== 'id' && Util.isPrimitive(v))
    .map(([k, v]) => ({ field: k.endsWith('__') ? k : `${k}__`, var: `:v_${k}`, value: toValue(v) }))
    .filter(({ value }) => !!value);
}

/**
 * A model service backed by DynamoDB
 */
@Injectable()
export class DynamoDBModelService implements ModelCrudSupport, ModelExpirySupport, ModelStorageSupport, ModelIndexedSupport {

  cl: dynamodb.DynamoDB;

  constructor(private config: DynamoDBModelConfig) { }

  private resolveTable(cls: Class) {
    let table = ModelRegistry.getStore(cls);
    if (this.config.namespace) {
      table = `${this.config.namespace}_${table}`;
    }
    return table;
  }

  private async putItem<T extends ModelType>(cls: Class<T>, id: string, item: T, mode: 'create' | 'update' | 'upsert') {
    const entries = toEntries(item);
    try {
      if (mode === 'create') {
        return await this.cl.putItem({
          TableName: this.resolveTable(cls),
          ConditionExpression: 'attribute_not_exists(body)',
          Item: {
            id: toValue(item.id),
            body: toValue(JSON.stringify(item)),
            ...Object.fromEntries(entries.map(v => [v.field, v.value]))
          },
          ReturnValues: 'NONE'
        });
      } else {
        return await this.cl.updateItem({
          TableName: this.resolveTable(cls),
          ConditionExpression: mode === 'update' ? 'attribute_exists(body)' : undefined,
          Key: { id: { S: id } },
          UpdateExpression: `SET ${[{ var: ':body', field: 'body' }, ...entries]
            .map(v => `${v.field} = ${v.var}`)
            .join(', ')}`,
          ExpressionAttributeValues: {
            ':body': toValue(JSON.stringify(item)),
            ...Object.fromEntries(entries.map(v => [v.var, v.value]))
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

  async postConstruct() {
    this.cl = new dynamodb.DynamoDB({ ...this.config.config });
    ShutdownManager.onShutdown(__filename, () => this.cl.destroy());
  }

  // Storage

  /**
   * An event listener for whenever a model is added, changed or removed
   */
  async onModelVisiblityChange?<T extends ModelType>(e: ChangeEvent<Class<T>>) {
    switch (e.type) {
      case 'added': {
        const table = this.resolveTable(e.curr!);
        const { Table: verify } = (await this.cl.describeTable({ TableName: table }).catch(err => ({ Table: undefined })));

        if (!verify) {
          await this.cl.createTable({
            TableName: table,
            KeySchema: [{ KeyType: 'HASH', AttributeName: 'id' }],
            BillingMode: 'PAY_PER_REQUEST',
            AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
          });

          await this.cl.updateTimeToLive({
            TableName: table,
            TimeToLiveSpecification: { AttributeName: 'internal_expires_at', Enabled: true }
          });
        }
        break;
      }
      case 'removing': {
        const table = this.resolveTable(e.curr!);
        const { Table: verify } = (await this.cl.describeTable({ TableName: table }).catch(err => ({ Table: undefined })));
        if (verify) {
          await this.cl.deleteTable({ TableName: table });
        }
        break;
      }
    }
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
    // Do nothing for now
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
    const expiresAt = ModelExpiryUtil.getExpiresAt(ttl);

    /* eslint-disable @typescript-eslint/naming-convention */
    const entries = toEntries({
      internal_expires_at: Math.trunc(expiresAt.getTime() / 1000),
      internal_issued_at: Math.trunc(new Date().getTime() / 1000)
    });
    /* eslint-enable @typescript-eslint/naming-convention */

    const res = await this.cl.updateItem({
      TableName: this.resolveTable(cls),
      Key: { id: { S: id } },
      ReturnValues: 'ALL_OLD',
      UpdateExpression: `SET ${entries.map(v => `${v.field} = ${v.var}`).join(', ')}`,
      ExpressionAttributeValues: Object.fromEntries(entries.map(v => [v.var, v.value]))
    });

    if (!res.Attributes) {
      throw new NotFoundError(cls, id);
    }
  }

  async upsertWithExpiry<T extends ModelType>(cls: Class<T>, item: T, ttl: number) {
    item = await this.upsert(cls, item);
    await this.updateExpiry(cls, item.id!, ttl);
    return item;
  }

  async getExpiry<T extends ModelType>(cls: Class<T>, id: string) {
    const res = await this.cl.getItem({
      TableName: this.resolveTable(cls),
      Key: { id: toValue(id) },
    });
    if (!res.Item) {
      throw new NotFoundError(cls, id);
    }
    const item = res.Item!;
    if (!(item.internal_issued_at__ && item.internal_issued_at__)) {
      throw new NotFoundError(cls, id);
    }
    const expiresAt = parseInt(`${item.internal_expires_at__.N}`, 10) * 1000;
    const issuedAt = parseInt(`${item.internal_issued_at__.N}`, 10) * 1000;

    return {
      issuedAt,
      expiresAt,
      expired: expiresAt < Date.now(),
      maxAge: expiresAt - issuedAt
    };
  }

  // Indexed
  async createIndex<T extends ModelType>(cls: Class<T>, idx: IndexConfig<T>) {
    const table = await this.cl.describeTable({ TableName: this.resolveTable(cls) });
    if (table.Table?.GlobalSecondaryIndexes?.find(x => x.IndexName === idx.name)) {
      return;
    }
    await this.cl.updateTable({
      TableName: this.resolveTable(cls),
      AttributeDefinitions:
        ModelIndexedUtil.flattenIndex(cls, idx, '_').fields.map(([key]) => ({ AttributeName: `${key}__`, AttributeType: 'S' })),
      GlobalSecondaryIndexUpdates: [{
        Create: {
          IndexName: idx.name,
          Projection: {
            ProjectionType: 'INCLUDE',
            NonKeyAttributes: ['id']
          },
          KeySchema: ModelIndexedUtil.flattenIndex(cls, idx, '_').fields.map(([key, value]) => ({
            AttributeName: `${key}__`,
            KeyType: 'HASH'
          }))
        }
      }]
    });
  }

  async getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>) {
    const config = ModelIndexedUtil.flattenIndexItem(cls, idx, body, '_');
    const result = await this.cl.query({
      TableName: this.resolveTable(cls),
      IndexName: idx,
      ProjectionExpression: 'id',
      KeyConditionExpression: config.map(([key, value]) => `${key}__ = :v_${key}`).join(', '),
      ExpressionAttributeValues: Object.fromEntries(config.map(([key, value]) => [`:v_${key}`, toValue(value)])),
    });

    if (result.Items && result.Items[0]) {
      return this.get(cls, result.Items[0].id.S!);
    }
    throw new NotFoundError(`${cls.name} Index=${idx}`, ModelIndexedUtil.computeIndexKey(cls, idx, body, '; '));
  }
}