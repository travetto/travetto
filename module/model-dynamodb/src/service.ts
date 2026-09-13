import timers from 'node:timers/promises';

import {
  type AttributeValue,
  DynamoDB,
  type PutItemCommandInput,
  type PutItemCommandOutput,
  type QueryCommandInput,
  type QueryCommandOutput
} from '@aws-sdk/client-dynamodb';

import { Injectable, PostConstruct } from '@travetto/di';
import {
  ExistsError,
  type ModelCrudSupport,
  ModelCrudUtil,
  type ModelExpirySupport,
  ModelExpiryUtil,
  type ModelListOptions,
  ModelRegistryIndex,
  type ModelStorageSupport,
  ModelStorageUtil,
  type ModelType,
  NotFoundError,
  type OptionalId
} from '@travetto/model';
import {
  type FullKeyedIndexBody,
  type FullKeyedIndexWithPartialBody,
  isModelIndexedIndex,
  type KeyedIndexBody,
  type KeyedIndexSelection,
  ModelIndexedComputedIndex,
  type ModelIndexedSearchOptions,
  type ModelIndexedSupport,
  ModelIndexedUtil,
  type ModelPageOptions,
  type ModelPageResult,
  type SingleItemIndex,
  type SortedIndex,
  type SortedIndexSelection,
  type SortedIndexSelectionType
} from '@travetto/model-indexed';
import { type Class, castTo, JSONUtil, ShutdownManager, TimeUtil } from '@travetto/runtime';

import type { DynamoDBModelConfig } from './config.ts';
import { DynamoDBUtil } from './util.ts';

const EXPIRES_ATTRIBUTE = 'expires_at__';

const getKey = <T extends ModelType>(computed: ModelIndexedComputedIndex<T>): AttributeValue =>
  DynamoDBUtil.toValue(computed.getKey() || 'NULL');
const getSort = <T extends ModelType>(computed: ModelIndexedComputedIndex<T>): AttributeValue => DynamoDBUtil.toValue(computed.getSort());

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'ResourceNotFoundException' || error.name === 'ResourceInUseException');
}

/**
 * A model service backed by DynamoDB
 */
@Injectable()
export class DynamoDBModelService implements ModelCrudSupport, ModelExpirySupport, ModelStorageSupport, ModelIndexedSupport {
  idSource = ModelCrudUtil.uuidSource();
  client: DynamoDB;
  config: DynamoDBModelConfig;

  constructor(config: DynamoDBModelConfig) {
    this.config = config;
  }

  #resolveTable(cls: Class): string {
    let table = ModelRegistryIndex.getStoreName(cls);
    if (this.config.namespace) {
      table = `${this.config.namespace}_${table}`;
    }
    return table;
  }

  async *#scanCollection<T extends ModelType>(
    cls: Class<T>,
    query: (batchSize: number, lastKey: Record<string, AttributeValue> | undefined) => Promise<QueryCommandOutput>,
    options?: ModelListOptions & ModelPageOptions<Record<string, AttributeValue>>
  ): AsyncIterable<{ items: T[]; lastKey?: Record<string, AttributeValue> }> {
    const batchSize = options?.batchSizeHint ?? 100;
    const limit = options?.limit ?? Number.MAX_SAFE_INTEGER;
    let startKey = options?.offset ?? undefined;
    let produced = 0;
    do {
      const remaining = limit - produced;
      const batch = await query(Math.min(remaining, batchSize), startKey);

      if (batch.Count && batch.Items) {
        produced += batch.Count;

        const items = produced > limit ? batch.Items.slice(0, remaining) : batch.Items;
        startKey = batch.LastEvaluatedKey;
        yield {
          items: await ModelCrudUtil.filterOutNotFound(items.map(item => DynamoDBUtil.loadAndCheckExpiry(cls, item.body.S!))),
          lastKey: startKey
        };
      } else {
        startKey = undefined;
      }
    } while (startKey && produced < limit && !options?.abort?.aborted);
  }

  async *#scanIndex<T extends ModelType>(
    cls: Class<T>,
    idx: SortedIndex<T>,
    body: KeyedIndexBody<T>,
    options?: ModelPageOptions<Record<string, AttributeValue>> & ModelListOptions,
    transform?: (query: QueryCommandInput) => QueryCommandInput
  ): AsyncIterable<{ items: T[]; lastKey?: Record<string, AttributeValue> }> {
    ModelCrudUtil.ensureNotSubType(cls);
    const computed = ModelIndexedComputedIndex.get(idx, body).validate();
    const { keyIndexName, keyIndexAttribute } = DynamoDBUtil.indexNames(idx.name);
    const expression = { [`:${keyIndexName}`]: getKey(computed) };

    const finalTransform = transform ?? ((query): QueryCommandInput => query);

    yield* this.#scanCollection(
      cls,
      (batchSize, lastKey) => {
        const finalized = finalTransform({
          TableName: this.#resolveTable(cls),
          IndexName: keyIndexName,
          ProjectionExpression: 'body',
          KeyConditionExpression: `${keyIndexAttribute} = :${keyIndexName}`,
          ExpressionAttributeValues: expression,
          Limit: batchSize,
          ExclusiveStartKey: lastKey
        });
        return this.client.query(finalized);
      },
      options
    );
  }

  async #getIdByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexBody<T, K, S>
  ): Promise<string> {
    ModelCrudUtil.ensureNotSubType(cls);

    const computed = ModelIndexedComputedIndex.get(idx, body).validate({ sort: true });

    const { keyIndexName, keyIndexAttribute, sortIndexAttribute, sortIndexName } = DynamoDBUtil.indexNames(idx.name);
    const sorted = idx.type === 'indexed:sorted';

    const query: QueryCommandInput = {
      TableName: this.#resolveTable(cls),
      IndexName: keyIndexName,
      ProjectionExpression: 'id',
      KeyConditionExpression: [
        ...(sorted ? [`${sortIndexAttribute} = :${sortIndexName}`] : []),
        `${keyIndexAttribute} = :${keyIndexName}`
      ].join(' and '),
      ...(computed.idPart
        ? {
            FilterExpression: 'id = :id'
          }
        : {}),
      ExpressionAttributeValues: {
        [`:${keyIndexName}`]: getKey(computed),
        ...(sorted ? { [`:${sortIndexName}`]: getSort(computed) } : {}),
        ...(computed.idPart ? { ':id': DynamoDBUtil.toValue(computed.idPart.value) } : {})
      }
    };

    try {
      const result = await this.client.query(query);

      if (result.Count && result.Items?.[0]) {
        return result.Items[0].id.S!;
      }
      throw new NotFoundError(`${cls.name} Index=${idx}`, computed.getKey({ sort: true }));
    } catch (error) {
      if (error instanceof Error && error.message.includes('The table does not have the specified index')) {
        throw new NotFoundError(`${cls.name} Index=${idx}`, computed.getKey({ sort: true }));
      }
      throw error;
    }
  }

  async #putItem<T extends ModelType>(
    cls: Class<T>,
    id: string,
    item: T,
    mode: 'create' | 'update' | 'upsert'
  ): Promise<PutItemCommandOutput> {
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
        for (const idx of ModelRegistryIndex.getIndices(cls)) {
          if (isModelIndexedIndex(idx)) {
            const { keyIndexAttribute, sortIndexAttribute } = DynamoDBUtil.indexNames(idx.name);
            const computed = ModelIndexedComputedIndex.get(idx, item).validate({ sort: true });
            switch (idx.type) {
              case 'indexed:keyed':
                indices[keyIndexAttribute] = getKey(computed);
                break;
              case 'indexed:sorted': {
                indices[keyIndexAttribute] = getKey(computed);
                indices[sortIndexAttribute] = getSort(computed);
                break;
              }
            }
          } else {
            console.warn('Unsupported index type on update', { cls: cls.name, idx });
          }
        }
        const query: PutItemCommandInput = {
          TableName: this.#resolveTable(cls),
          ConditionExpression: 'attribute_not_exists(body)',
          Item: {
            id: DynamoDBUtil.toValue(item.id),
            body: DynamoDBUtil.toValue(JSONUtil.toUTF8(item)),
            ...(expiry !== undefined ? { [EXPIRES_ATTRIBUTE]: DynamoDBUtil.toValue(expiry) } : {}),
            ...indices
          },
          ReturnValues: 'NONE'
        };
        return await this.client.putItem(query);
      } else {
        const indices: Record<string, unknown> = {};
        const expr: string[] = [];

        for (const idx of ModelRegistryIndex.getIndices(cls)) {
          if (isModelIndexedIndex(idx)) {
            const { keyIndexAttribute, sortIndexAttribute, keyIndexName, sortIndexName } = DynamoDBUtil.indexNames(idx.name);
            const computed = ModelIndexedComputedIndex.get(idx, item).validate({ sort: true });
            switch (idx.type) {
              case 'indexed:keyed': {
                indices[`:${keyIndexName}`] = getKey(computed);
                expr.push(`${keyIndexAttribute} = :${keyIndexName}`);
                break;
              }
              case 'indexed:sorted': {
                indices[`:${keyIndexName}`] = getKey(computed);
                indices[`:${sortIndexName}`] = getSort(computed);
                expr.push(`${keyIndexAttribute} = :${keyIndexName}`);
                expr.push(`${sortIndexAttribute} = :${sortIndexName}`);
                break;
              }
            }
          } else {
            console.warn('Unsupported index type on update', { cls: cls.name, idx });
          }
        }

        return await this.client.updateItem({
          TableName: this.#resolveTable(cls),
          ConditionExpression: mode === 'update' ? 'attribute_exists(body)' : undefined,
          Key: { id: { S: id } },
          UpdateExpression: `SET ${['body=:body', expiry !== undefined ? `${EXPIRES_ATTRIBUTE}=:expr` : undefined, ...expr]
            .filter(part => !!part)
            .join(', ')}`,
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

  @PostConstruct()
  async initializeClient(): Promise<void> {
    this.client = new DynamoDB({ ...this.config.client });
    await ModelStorageUtil.storageInitialization(this);
    ShutdownManager.signal.addEventListener('abort', async () => this.client.destroy());
  }

  // Storage

  /**
   * Add a new model
   * @param cls
   */
  async #waitForTableNotExists(tableName: string): Promise<void> {
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const describeResponse = await ModelStorageUtil.runAndIgnoreNotFound(
        () => this.client.describeTable({ TableName: tableName }),
        isNotFoundError
      );
      if (!describeResponse?.Table) {
        return;
      }
      await timers.setTimeout(100);
    }
    throw new Error(`Timed out waiting for table ${tableName} to be deleted`);
  }

  /**
   * Add a new model
   * @param modelClass
   */
  async upsertModel(modelClass: Class<ModelType>): Promise<void> {
    const tableName = this.#resolveTable(modelClass);
    const indexConfig = DynamoDBUtil.computeIndexConfig(modelClass);

    let [currentTable, currentTimeToLive] = await Promise.all([
      ModelStorageUtil.runAndIgnoreNotFound(() => this.client.describeTable({ TableName: tableName }), isNotFoundError),
      ModelStorageUtil.runAndIgnoreNotFound(() => this.client.describeTimeToLive({ TableName: tableName }), isNotFoundError)
    ]);

    if (currentTable?.Table?.TableStatus === 'DELETING') {
      await this.#waitForTableNotExists(tableName);
      currentTable = undefined;
    }

    if (!currentTable) {
      console.debug('Creating Table', { tableName, indexConfig });
      await this.client.createTable({
        TableName: tableName,
        KeySchema: [{ KeyType: 'HASH', AttributeName: 'id' }],
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }, ...indexConfig.attributes],
        GlobalSecondaryIndexes: indexConfig.indices
      });
    } else {
      const indexUpdates = DynamoDBUtil.findChangedGlobalIndexes(currentTable.Table?.GlobalSecondaryIndexes, indexConfig.indices);
      const changedAttributes = DynamoDBUtil.findChangedAttributes(currentTable.Table?.AttributeDefinitions, indexConfig.attributes);

      console.debug('Updating Table', { tableName, indexConfig, current: currentTable.Table, indexUpdates, changedAttributes });

      if (changedAttributes.length || indexUpdates?.length) {
        await this.client.updateTable({
          TableName: tableName,
          AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }, ...indexConfig.attributes],
          GlobalSecondaryIndexUpdates: indexUpdates
        });
      }
    }

    const timeToLiveRequired = ModelRegistryIndex.getConfig(modelClass).expiresAt !== undefined;
    const timeToLiveEnabled = currentTimeToLive?.TimeToLiveDescription?.TimeToLiveStatus === 'ENABLED';
    if (timeToLiveEnabled !== timeToLiveRequired) {
      await this.client.updateTimeToLive({
        TableName: tableName,
        TimeToLiveSpecification: { AttributeName: timeToLiveRequired ? EXPIRES_ATTRIBUTE : undefined, Enabled: timeToLiveRequired }
      });
    }
  }

  async deleteModel(modelClass: Class<ModelType>): Promise<void> {
    const tableName = this.#resolveTable(modelClass);
    const verify = await ModelStorageUtil.runAndIgnoreNotFound(() => this.client.describeTable({ TableName: tableName }), isNotFoundError);
    if (verify?.Table) {
      if (verify.Table.TableStatus !== 'DELETING') {
        await ModelStorageUtil.runAndIgnoreNotFound(() => this.client.deleteTable({ TableName: tableName }), isNotFoundError);
      }
      await this.#waitForTableNotExists(tableName);
    }
  }

  async truncateModel<T extends ModelType>(modelClass: Class<T>): Promise<void> {
    const tableName = this.#resolveTable(modelClass);
    let startKey: Record<string, AttributeValue> | undefined;
    do {
      const scanResult = await this.client.scan({
        TableName: tableName,
        ProjectionExpression: 'id',
        ExclusiveStartKey: startKey,
        Limit: 25
      });
      startKey = scanResult.LastEvaluatedKey;
      const items = scanResult.Items ?? [];
      if (items.length > 0) {
        await this.client.batchWriteItem({
          RequestItems: {
            [tableName]: items.map(item => ({
              DeleteRequest: {
                Key: { id: item.id }
              }
            }))
          }
        });
      }
    } while (startKey);
  }

  async createStorage(): Promise<void> {
    // Do nothing
  }

  async deleteStorage(): Promise<void> {
    await Promise.all(ModelRegistryIndex.getClasses().map(modelClass => this.deleteModel(modelClass)));
  }

  // Crud
  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    const result = await this.client.getItem({
      TableName: this.#resolveTable(cls),
      Key: { id: DynamoDBUtil.toValue(id) }
    });

    if (result?.Item?.body) {
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

  async *list<T extends ModelType>(cls: Class<T>, options?: ModelListOptions): AsyncIterable<T[]> {
    for await (const { items } of this.#scanCollection(
      cls,
      (batchSize, lastKey) =>
        this.client.scan({
          TableName: this.#resolveTable(cls),
          ExclusiveStartKey: lastKey,
          Limit: batchSize
        }),
      options
    )) {
      yield items;
    }
  }

  // Expiry
  async deleteExpired<T extends ModelType>(_cls: Class<T>): Promise<number> {
    return -1;
  }

  // Indexed
  async getByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexBody<T, K, S>
  ): Promise<T> {
    return this.get(cls, await this.#getIdByIndex(cls, idx, body));
  }

  async deleteByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexBody<T, K, S>
  ): Promise<void> {
    return this.delete(cls, await this.#getIdByIndex(cls, idx, body));
  }

  upsertByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SingleItemIndex<T, K, S>,
    body: OptionalId<T>
  ): Promise<T> {
    return ModelIndexedUtil.naiveUpsert(this, cls, idx, body);
  }

  async updateByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SingleItemIndex<T, K, S>,
    body: T
  ): Promise<T> {
    return ModelIndexedUtil.naiveUpdate(this, cls, idx, body);
  }

  async updatePartialByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SingleItemIndex<T, K, S>,
    body: FullKeyedIndexWithPartialBody<T, K, S>
  ): Promise<T> {
    const item = await ModelCrudUtil.naivePartialUpdate(cls, () => this.getByIndex(cls, idx, castTo(body)), castTo(body));
    return this.update(cls, item);
  }

  async pageByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    options?: ModelPageOptions
  ): Promise<ModelPageResult<T>> {
    const output: T[] = [];
    const offset = options?.offset ? JSONUtil.fromBase64<Record<string, AttributeValue>>(options.offset) : undefined;
    for await (const { items } of this.#scanIndex(cls, idx, body, { limit: 100, ...options, offset })) {
      output.push(...items);
    }

    let nextOffset: string | undefined;
    if (output.length) {
      const last: T = output.at(-1)!;
      const computed = ModelIndexedComputedIndex.get(idx, last).validate();
      const { keyIndexAttribute, sortIndexAttribute } = DynamoDBUtil.indexNames(idx.name);
      nextOffset = JSONUtil.toBase64({
        [keyIndexAttribute]: getKey(computed),
        [sortIndexAttribute]: getSort(computed),
        id: DynamoDBUtil.toValue(last.id)
      });
    }

    return { items: output, nextOffset };
  }

  async *listByIndex<T extends ModelType, K extends KeyedIndexSelection<T>, S extends SortedIndexSelection<T>>(
    cls: Class<T>,
    idx: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    options?: ModelListOptions
  ): AsyncIterable<T[]> {
    for await (const { items } of this.#scanIndex(cls, idx, body, options)) {
      yield items;
    }
  }

  async suggestByIndex<
    T extends ModelType,
    S extends SortedIndexSelection<T>,
    K extends KeyedIndexSelection<T>,
    B extends SortedIndexSelectionType<T, S> & string
  >(cls: Class<T>, idx: SortedIndex<T, K, S>, body: KeyedIndexBody<T, K>, prefix: B, options?: ModelIndexedSearchOptions): Promise<T[]> {
    const results: T[] = [];

    const { sortIndexAttribute } = DynamoDBUtil.indexNames(idx.name);

    for await (const { items } of this.#scanIndex(cls, idx, body, { limit: 10, ...options }, query => ({
      ...query,
      KeyConditionExpression: [query.KeyConditionExpression, `begins_with(${sortIndexAttribute}, :prefix)`].filter(Boolean).join(' AND '),
      ExpressionAttributeValues: {
        ...query.ExpressionAttributeValues,
        ':prefix': { S: prefix }
      }
    }))) {
      results.push(...items);
    }

    return results;
  }
}
