import * as dynamodb from '@aws-sdk/client-dynamodb';

import { ShutdownManager, Util } from '@travetto/base';
import { Injectable } from '@travetto/di';
import { ChangeEvent, Class } from '@travetto/registry';
import { ModelCrudSupport, ModelExpirySupport, ModelRegistry, ModelStorageSupport, ModelType } from '@travetto/model-core';

import { DynamoDBModelConfig } from './config';
import { ModelCrudUtil } from '@travetto/model-core/src/internal/service/crud';


/**
 * A model service backed by DynamoDB
 */
@Injectable()
export class DynamoDBModelService implements ModelCrudSupport, /*ModelExpirySupport,*/ ModelStorageSupport {

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
    let conditionExpression: string | undefined;

    if (mode === 'create' || mode === 'update') {
      conditionExpression = `${mode === 'update' ? 'attribute_exists' : 'attribute_not_exists'}(body)`;
    }
    try {
      return await this.cl.putItem({
        TableName: this.resolveTable(cls),
        ConditionExpression: conditionExpression,
        Item: {
          id: { S: item.id },
          body: { S: JSON.stringify(item) },
          updated_at: { S: new Date().toISOString() }
        },
        ReturnValues: 'NONE'
      });
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        if (mode === 'create') {
          throw ModelCrudUtil.existsError(cls, id);
        } else if (mode === 'update') {
          throw ModelCrudUtil.notFoundError(cls, id);
        }
      }
      throw err;
    }
  }

  async postConstruct() {
    this.cl = new dynamodb.DynamoDB(this.config);
    console!.log(this.config);
    ShutdownManager.onShutdown(__filename, () => this.cl.destroy());
  }

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
            KeySchema: [{
              KeyType: 'HASH',
              AttributeName: 'id'
            }, {
              KeyType: 'RANGE',
              AttributeName: 'updated_at'
            }],
            BillingMode: 'PAY_PER_REQUEST',
            AttributeDefinitions: [
              { AttributeName: 'id', AttributeType: 'S' }
            ],
          });

          await this.cl.updateTimeToLive({
            TableName: table,
            TimeToLiveSpecification: {
              AttributeName: 'expires_at',
              Enabled: true
            }
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
    // Do nothing for now
  }

  uuid(): string {
    return Util.uuid();
  }

  async get<T extends ModelType>(cls: Class<T>, id: string) {
    const item = await this.getOptional(cls, id);
    if (!item) {
      throw ModelCrudUtil.notFoundError(cls, id);
    }
    return item;
  }

  async getOptional<T extends ModelType>(cls: Class<T>, id: string) {
    const res = await this.cl.getItem({
      TableName: this.resolveTable(cls),
      Key: { id: { S: id } }
    });
    return ModelCrudUtil.load(cls, res.Item?.body.S);
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
    this.putItem(cls, item.id!, item, 'update');
    return item as T;
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    const res = await this.cl.deleteItem({
      TableName: this.resolveTable(cls),
      ReturnValues: 'ALL_OLD',
      Key: { id: { S: id } }
    });
    if (!res.Attributes) {
      throw ModelCrudUtil.notFoundError(cls, id);
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
      token = batch.LastEvaluatedKey;
      if (batch.Count && batch.Items) {
        for (const el of batch.Items) {
          const res = await ModelCrudUtil.load(cls, el.body.S);
          if (res) {
            yield res;
          }
        }
      } else {
        done = false;
      }
    }
  }
}

/*
  async get(key: string): Promise<CacheEntry | undefined> {
    const res = await this.cl.getItem({
      TableName: this.table,
      Key: { key: { S: key } }
    });
    const val = res.Item;
    if (val && val.body.S) {
      const ret = CacheSourceUtil.readAsSafeJSON(val.body.S);
      return ret;
    }
  }

  async has(key: string): Promise<boolean> {
    return !!(await this.get(key));
  }

  async set(key: string, entry: CacheEntry): Promise<any> {
    if (entry.maxAge) {
      entry.expiresAt = entry.maxAge + Date.now();
    }

    const cloned = CacheSourceUtil.storeAsSafeJSON(entry);

    await this.cl.putItem({
      TableName: this.table,
      Item: {
        key: { S: key },
        body: { S: cloned }
      }
    });

    if (entry.expiresAt) {
      await this.touch(key, entry.expiresAt);
    }

    return CacheSourceUtil.readAsSafeJSON(cloned);
  }

  async delete(key: string): Promise<boolean> {
    const res = await this.cl.deleteItem({
      TableName: this.table,
      ReturnValues: 'ALL_OLD',
      Key: { key: { S: key } }
    });
    return !!res.Attributes;
  }

  async isExpired(key: string) {
    return !(await this.has(key));
  }

  async touch(key: string, expiresAt: number): Promise<boolean> {
    const res = await this.cl.updateItem({
      TableName: this.table,
      Key: { key: { S: key } },
      ReturnValues: 'ALL_OLD',
      AttributeUpdates: {
        expires: {
          Action: 'PUT',
          Value: {
            N: `${Math.trunc(expiresAt / 1000)}`
          }
        }
      }
    });
    return !!res.Attributes;
  }

  async clear() {
    for (const key of await this.keys()) {
      await this.delete(key);
    }
  }

  async keys() {
    const out: string[] = [];
    let key: string | undefined = '';
    while (key !== undefined) {
      const req: dynamodb.ScanCommandOutput = await this.cl.scan({
        TableName: this.table,
        AttributesToGet: ['key'],
        ...(key ? { ExclusiveStartKey: { key: { S: key } } } : {})
      });
      out.push(...(req.Items?.map(x => x.key.S!) || []));
      key = req.LastEvaluatedKey?.key.S;
    }
    return out;
  }
 */