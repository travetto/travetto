import { type AttributeValue, DynamoDB, type PutItemCommandInput, type PutItemCommandOutput } from '@aws-sdk/client-dynamodb';

import { JSONUtil, ShutdownManager, TimeUtil, type Class, type DeepPartial } from '@travetto/runtime';
import { Injectable } from '@travetto/di';
import {
  type ModelCrudSupport, type ModelExpirySupport, ModelRegistryIndex, type ModelStorageSupport,
  type ModelIndexedSupport, type ModelType, NotFoundError, ExistsError,
  IndexNotSupported, type OptionalId,
  ModelCrudUtil, ModelExpiryUtil, ModelIndexedUtil, ModelStorageUtil
} from '@travetto/model';

import type { DynamoDBModelConfig } from './config.ts';
import { DynamoDBUtil } from './util.ts';

const EXP_ATTR = 'expires_at__';

/**
 * A model service backed by DynamoDB
 */
@Injectable()
export class DynamoDBModelService implements ModelCrudSupport, ModelExpirySupport, ModelStorageSupport, ModelIndexedSupport {

  idSource = ModelCrudUtil.uuidSource();
  client: DynamoDB;
  config: DynamoDBModelConfig;

  constructor(config: DynamoDBModelConfig) { this.config = config; }

  #resolveTable(cls: Class): string {
    let table = ModelRegistryIndex.getStoreName(cls);
    if (this.config.namespace) {
      table = `${this.config.namespace}_${table}`;
    }
    return table;
  }

  async #putItem<T extends ModelType>(cls: Class<T>, id: string, item: T, mode: 'create' | 'update' | 'upsert'): Promise<PutItemCommandOutput> {
    const config = ModelRegistryIndex.getConfig(cls);
    let expiry: number | undefined;

    if (config.expiresAt) {
      const { expiresAt } = ModelExpiryUtil.getExpiryState(cls, item);
      if (expiresAt) {
        expiry = TimeUtil.duration(expiresAt.getTime(), 's');
      }
    }

    try {
      if (mode === 'create') {
        const indices: Record<string, unknown> = {};
        for (const idx of config.indices ?? []) {
          const { key, sort } = ModelIndexedUtil.computeIndexKey(cls, idx, item);
          const property = DynamoDBUtil.simpleName(idx.name);
          indices[`${property}__`] = DynamoDBUtil.toValue(key);
          if (sort) {
            indices[`${property}_sort__`] = DynamoDBUtil.toValue(+sort);
          }
        }
        const query: PutItemCommandInput = {
          TableName: this.#resolveTable(cls),
          ConditionExpression: 'attribute_not_exists(body)',
          Item: {
            id: DynamoDBUtil.toValue(item.id),
            body: DynamoDBUtil.toValue(JSONUtil.toUTF8(item)),
            ...(expiry !== undefined ? { [EXP_ATTR]: DynamoDBUtil.toValue(expiry) } : {}),
            ...indices
          },
          ReturnValues: 'NONE'
        };
        return await this.client.putItem(query);
      } else {
        const indices: Record<string, unknown> = {};
        const expr: string[] = [];
        for (const idx of config.indices ?? []) {
          const { key, sort } = ModelIndexedUtil.computeIndexKey(cls, idx, item);
          const property = DynamoDBUtil.simpleName(idx.name);
          indices[`:${property}`] = DynamoDBUtil.toValue(key);
          expr.push(`${property}__ = :${property}`);
          if (sort) {
            indices[`:${property}_sort`] = DynamoDBUtil.toValue(+sort);
            expr.push(`${property}_sort__ = :${property}_sort`);
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
          ].filter(part => !!part).join(', ')}`,
          ExpressionAttributeValues: {
            ':body': DynamoDBUtil.toValue(JSONUtil.toUTF8(item)),
            ...(expiry !== undefined ? { ':expr': DynamoDBUtil.toValue(expiry) } : {}),
            ...indices
          },
          ReturnValues: 'ALL_NEW'
        });
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
        if (mode === 'create') {
          throw new ExistsError(cls, id);
        } else if (mode === 'update') {
          throw new NotFoundError(cls, id);
        }
      }
      throw error;
    }
  }

  async postConstruct(): Promise<void> {
    this.client = new DynamoDB({ ...this.config.client });
    await ModelStorageUtil.storageInitialization(this);
    ShutdownManager.signal.addEventListener('abort', async () => this.client.destroy());
  }

  // Storage

  /**
   * Add a new model
   * @param cls
   */
  async upsertModel(cls: Class<ModelType>): Promise<void> {
    const table = this.#resolveTable(cls);
    const idx = DynamoDBUtil.computeIndexConfig(cls);

    const [currentTable, currentTTL] = await Promise.all([
      this.client.describeTable({ TableName: table }).catch(() => undefined),
      this.client.describeTimeToLive({ TableName: table }).catch(() => ({ TimeToLiveDescription: undefined }))
    ]);

    if (!currentTable) {
      console.debug('Creating Table', { table, idx });
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
    } else {
      const indexUpdates = DynamoDBUtil.findChangedGlobalIndexes(currentTable.Table?.GlobalSecondaryIndexes, idx.indices);
      const changedAttributes = DynamoDBUtil.findChangedAttributes(currentTable.Table?.AttributeDefinitions, idx.attributes);

      console.debug('Updating Table', { table, idx, current: currentTable.Table, indexUpdates, changedAttributes });

      if (changedAttributes.length || indexUpdates?.length) {
        await this.client.updateTable({
          TableName: table,
          AttributeDefinitions: [
            { AttributeName: 'id', AttributeType: 'S' },
            ...idx.attributes
          ],
          GlobalSecondaryIndexUpdates: indexUpdates
        });
      }
    }

    const ttlRequired = ModelRegistryIndex.getConfig(cls).expiresAt !== undefined;
    const ttlEnabled = currentTTL.TimeToLiveDescription?.TimeToLiveStatus === 'ENABLED';
    if (ttlEnabled !== ttlRequired) {
      await this.client.updateTimeToLive({
        TableName: table,
        TimeToLiveSpecification: { AttributeName: ttlRequired ? EXP_ATTR : undefined, Enabled: ttlRequired }
      });
    }
  }

  /**
   * Remove a model
   * @param cls
   */
  async deleteModel(cls: Class<ModelType>): Promise<void> {
    const table = this.#resolveTable(cls);
    const { Table: verify } = (await this.client.describeTable({ TableName: table }).catch(() => ({ Table: undefined })));
    if (verify) {
      await this.client.deleteTable({ TableName: table });
    }
  }

  async createStorage(): Promise<void> {
    // Do nothing
  }

  async deleteStorage(): Promise<void> {
    for (const model of ModelRegistryIndex.getClasses()) {
      await this.client.deleteTable({
        TableName: this.#resolveTable(model)
      }).catch(() => { });
    }
  }

  // Crud
  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    const result = await this.client.getItem({
      TableName: this.#resolveTable(cls),
      Key: { id: DynamoDBUtil.toValue(id) }
    });

    if (result && result.Item && result.Item.body) {
      return DynamoDBUtil.loadAndCheckExpiry(cls, result.Item.body.S!);
    }
    throw new NotFoundError(cls, id);
  }

  async create<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    const prepped = await ModelCrudUtil.preStore(cls, item, this);
    await this.#putItem(cls, prepped.id, prepped, 'create');
    return prepped;
  }

  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);
    item = await ModelCrudUtil.preStore(cls, item, this);
    if (ModelRegistryIndex.getConfig(cls).expiresAt) {
      await this.get(cls, item.id);
    }
    await this.#putItem(cls, item.id, item, 'update');
    return item;
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);
    const prepped = await ModelCrudUtil.preStore(cls, item, this);
    await this.#putItem(cls, prepped.id, prepped, 'upsert');
    return prepped;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);
    const id = item.id;
    const itemAsT = await ModelCrudUtil.naivePartialUpdate(cls, () => this.get(cls, id), item, view);
    await this.#putItem(cls, id, itemAsT, 'update');
    return itemAsT;
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void> {
    ModelCrudUtil.ensureNotSubType(cls);
    const result = await this.client.deleteItem({
      TableName: this.#resolveTable(cls),
      ReturnValues: 'ALL_OLD',
      Key: { id: { S: id } }
    });
    if (!result.Attributes) {
      throw new NotFoundError(cls, id);
    }
  }

  async * list<T extends ModelType>(cls: Class<T>): AsyncIterable<T> {
    let done = false;
    let token: Record<string, AttributeValue> | undefined;
    while (!done) {
      const batch = await this.client.scan({
        TableName: this.#resolveTable(cls),
        ExclusiveStartKey: token
      });

      if (batch.Count && batch.Items) {
        for (const item of batch.Items) {
          try {
            yield await DynamoDBUtil.loadAndCheckExpiry(cls, item.body.S!);
          } catch (error) {
            if (!(error instanceof NotFoundError)) {
              throw error;
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
  async deleteExpired<T extends ModelType>(_cls: Class<T>): Promise<number> {
    return -1;
  }

  // Indexed
  async #getIdByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<string> {
    ModelCrudUtil.ensureNotSubType(cls);

    const idxConfig = ModelRegistryIndex.getIndex(cls, idx, ['sorted', 'unsorted']);

    const { key, sort } = ModelIndexedUtil.computeIndexKey(cls, idxConfig, body);

    if (idxConfig.type === 'sorted' && sort === undefined) {
      throw new IndexNotSupported(cls, idxConfig, 'Sorted indices require the sort field');
    }

    const idxName = DynamoDBUtil.simpleName(idx);

    const query = {
      TableName: this.#resolveTable(cls),
      IndexName: idxName,
      ProjectionExpression: 'id',
      KeyConditionExpression: [sort ? `${idxName}_sort__ = :${idxName}_sort` : '', `${idxName}__ = :${idxName}`]
        .filter(expr => !!expr)
        .join(' and '),
      ExpressionAttributeValues: {
        [`:${idxName}`]: DynamoDBUtil.toValue(key),
        ...(sort ? { [`:${idxName}_sort`]: DynamoDBUtil.toValue(+sort) } : {})
      }
    };

    const result = await this.client.query(query);

    if (result.Count && result.Items && result.Items[0]) {
      return result.Items[0].id.S!;
    }
    throw new NotFoundError(`${cls.name} Index=${idx}`, key);
  }

  // Indexed
  async getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<T> {
    return this.get(cls, await this.#getIdByIndex(cls, idx, body));
  }

  async deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<void> {
    return this.delete(cls, await this.#getIdByIndex(cls, idx, body));
  }

  upsertByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: OptionalId<T>): Promise<T> {
    return ModelIndexedUtil.naiveUpsert(this, cls, idx, body);
  }

  async * listByIndex<T extends ModelType>(cls: Class<T>, idx: string, body?: DeepPartial<T>): AsyncIterable<T> {
    ModelCrudUtil.ensureNotSubType(cls);

    const config = ModelRegistryIndex.getIndex(cls, idx, ['sorted', 'unsorted']);
    const { key } = ModelIndexedUtil.computeIndexKey(cls, config, body, { emptySortValue: null });

    const idxName = DynamoDBUtil.simpleName(idx);

    let done = false;
    let token: Record<string, AttributeValue> | undefined;
    while (!done) {
      const batch = await this.client.query({
        TableName: this.#resolveTable(cls),
        IndexName: idxName,
        ProjectionExpression: 'body',
        KeyConditionExpression: `${idxName}__ = :${idxName}`,
        ExpressionAttributeValues: {
          [`:${idxName}`]: DynamoDBUtil.toValue(key)
        },
        ExclusiveStartKey: token
      });

      if (batch.Count && batch.Items) {
        for (const item of batch.Items) {
          try {
            yield await DynamoDBUtil.loadAndCheckExpiry(cls, item.body.S!);
          } catch (error) {
            if (!(error instanceof NotFoundError)) {
              throw error;
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