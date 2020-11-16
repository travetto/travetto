import * as dynamodb from '@aws-sdk/client-dynamodb';

import { ShutdownManager, Util } from '@travetto/base';
import { Injectable } from '@travetto/di';
import { ChangeEvent, Class } from '@travetto/registry';
import { ModelCrudSupport, ModelExpirySupport, ModelRegistry, ModelStorageSupport, ModelType } from '@travetto/model-core';

import { DynamoDBModelConfig } from './config';
import { ModelCrudUtil } from '@travetto/model-core/src/internal/service/crud';
import { ModelExpiryUtil } from '@travetto/model-core/src/internal/service/expiry';
import { ExistsError } from '@travetto/model-core/src/error/exists';
import { NotFoundError } from '@travetto/model-core/src/error/not-found';


/**
 * A model service backed by DynamoDB
 */
@Injectable()
export class DynamoDBModelService implements ModelCrudSupport, ModelExpirySupport, ModelStorageSupport {

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
    try {
      if (mode === 'create') {
        return await this.cl.putItem({
          TableName: this.resolveTable(cls),
          ConditionExpression: 'attribute_not_exists(body)',
          Item: {
            id: { S: item.id },
            body: { S: JSON.stringify(item) },
            updated_at: { S: new Date().toISOString() }
          },
          ReturnValues: 'NONE'
        });
      } else {
        return await this.cl.updateItem({
          TableName: this.resolveTable(cls),
          ConditionExpression: mode === 'update' ? 'attribute_exists(body)' : undefined,
          Key: { id: { S: id } },
          UpdateExpression: 'set body = :body, updated_at = :updated_at',
          ExpressionAttributeValues: {
            ':body': { S: JSON.stringify(item) },
            ':updated_at': { S: new Date().toISOString() }
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
            TimeToLiveSpecification: { AttributeName: 'expires_at_', Enabled: true }
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
    const res = await this.cl.getItem({
      TableName: this.resolveTable(cls),
      Key: { id: { S: id } }
    });

    if (res && res.Item?.body) {
      const item = await ModelCrudUtil.load(cls, res.Item.body.S!);
      if (item) {
        return item;
      }
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
          const res = await ModelCrudUtil.load(cls, el.body.S);
          if (res) {
            yield res;
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

  async updateExpiry<T extends ModelType>(cls: Class<T>, id: string, ttl: number) {
    const expiresAt = ModelExpiryUtil.getExpiresAt(ttl);
    const res = await this.cl.updateItem({
      TableName: this.resolveTable(cls),
      Key: { id: { S: id } },
      ReturnValues: 'ALL_OLD',
      UpdateExpression: `set expires_at_ = :expires_at, issued_at_ = :issued_at`,
      ExpressionAttributeValues: {
        ':expires_at': { N: `${Math.trunc(expiresAt.getTime() / 1000)}` },
        ':issued_at': { N: `${Math.trunc(new Date().getTime() / 1000)}` }
      }
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
      Key: { id: { S: id } },
    });
    if (!res.Item) {
      throw new NotFoundError(cls, id);
    }
    const item = res.Item!;
    if (!(item.expires_at_ && item.issued_at_)) {
      throw new NotFoundError(cls, id);
    }
    const expiresAt = parseInt(`${item.expires_at_.N}`, 10) * 1000;
    const issuedAt = parseInt(`${item.issued_at_.N}`, 10) * 1000;

    return {
      issuedAt,
      expiresAt,
      expired: expiresAt < Date.now(),
      maxAge: expiresAt - issuedAt
    };
  }
}