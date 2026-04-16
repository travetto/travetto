import { type AttributeValue, DynamoDB, type PutItemCommandInput, type PutItemCommandOutput, type QueryCommandInput, type QueryCommandOutput } from '@aws-sdk/client-dynamodb';

import { castTo, JSONUtil, ShutdownManager, TimeUtil, type Class } from '@travetto/runtime';
import { Injectable, PostConstruct } from '@travetto/di';
import {
  type ModelCrudSupport, type ModelExpirySupport, ModelRegistryIndex, type ModelStorageSupport,
  type ModelType, NotFoundError, ExistsError, type OptionalId, ModelCrudUtil,
  ModelExpiryUtil, ModelStorageUtil,
  type ModelListOptions,
} from '@travetto/model';
import {
  isModelIndexedIndex, ModelIndexedUtil, type KeyedIndexBody, type KeyedIndexSelection,
  type ModelPageOptions, type ModelPageResult, type ModelIndexedSupport, type SingleItemIndex,
  type FullKeyedIndexBody, type FullKeyedIndexWithPartialBody, type SortedIndex, type SortedIndexSelection,
  ModelIndexedComputedIndex,
  type ModelIndexedSearchOptions
} from '@travetto/model-indexed';

import type { DynamoDBModelConfig } from './config.ts';
import { DynamoDBUtil } from './util.ts';

const EXPIRES_ATTRIBUTE = 'expires_at__';

const getKey = <T extends ModelType>(computed: ModelIndexedComputedIndex<T>): AttributeValue => DynamoDBUtil.toValue(computed.getKey() || 'NULL');
const getSort = <T extends ModelType>(computed: ModelIndexedComputedIndex<T>): AttributeValue => DynamoDBUtil.toValue(computed.getSort());

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

  async * #scanCollection<T extends ModelType>(
    cls: Class<T>,
    query: (batchSize: number, lastKey: Record<string, AttributeValue> | undefined) => Promise<QueryCommandOutput>,
    options?: ModelListOptions & ModelPageOptions<Record<string, AttributeValue>>,
  ): AsyncIterable<{ items: T[], lastKey?: Record<string, AttributeValue> }> {
    const batchSize = options?.batchSizeHint ?? 100;
    const limit = options?.limit ?? Number.MAX_SAFE_INTEGER;
    let startKey = options?.offset ?? undefined;
    let produced = 0;
    do {
      const remaining = limit - produced;
      const batch = await query(Math.min(remaining, batchSize), startKey);

      if (batch.Count && batch.Items) {
        produced += batch.Count;

        const items = (produced > limit) ? batch.Items.slice(0, remaining) : batch.Items;
        startKey = batch.LastEvaluatedKey;
        yield {
          items: await ModelCrudUtil.filterOutNotFound(
            items.map(item => DynamoDBUtil.loadAndCheckExpiry(cls, item.body.S!))),
          lastKey: startKey
        };
      } else {
        startKey = undefined;
      }
    } while (startKey && produced < limit && !(options?.abort?.aborted));
  }

  async * #scanIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(
    cls: Class<T>,
    idx: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    options?: ModelPageOptions<Record<string, AttributeValue>> & ModelListOptions,
    transform?: (query: QueryCommandInput) => QueryCommandInput
  ): AsyncIterable<{ items: T[], lastKey?: Record<string, AttributeValue> }> {
    ModelCrudUtil.ensureNotSubType(cls);
    const computed = ModelIndexedComputedIndex.get(idx, body).validate();
    const safeName = DynamoDBUtil.toSafeName(idx.name);
    const expression = { [`:${safeName}`]: getKey(computed) };

    const finalTransform = transform ?? ((query) => query);

    yield* this.#scanCollection(cls, (batchSize, lastKey) => this.client.query(finalTransform({
      TableName: this.#resolveTable(cls),
      IndexName: safeName,
      ProjectionExpression: 'body',
      KeyConditionExpression: `${safeName}__ = :${safeName}`,
      ExpressionAttributeValues: expression,
      Limit: batchSize,
      ExclusiveStartKey: lastKey,
    })), options);
  }

  async #getIdByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(cls: Class<T>, idx: SingleItemIndex<T, K, S>, body: FullKeyedIndexBody<T, K, S>): Promise<string> {
    ModelCrudUtil.ensureNotSubType(cls);

    const computed = ModelIndexedComputedIndex.get(idx, body).validate({ sort: true });

    const safeName = DynamoDBUtil.toSafeName(idx.name);
    const sorted = idx.type === 'indexed:sorted';

    const query: QueryCommandInput = {
      TableName: this.#resolveTable(cls),
      IndexName: safeName,
      ProjectionExpression: 'id',
      KeyConditionExpression: [
        ...(sorted ? [`${safeName}_sort__ = :${safeName}_sort`] : []),
        `${safeName}__ = :${safeName}`
      ]
        .join(' and '),
      ...(computed.idPart ? {
        FilterExpression: 'id = :id'
      } : {}),
      ExpressionAttributeValues: {
        [`:${safeName}`]: getKey(computed),
        ...(sorted ? { [`:${safeName}_sort`]: getSort(computed) } : {}),
        ...(computed.idPart ? { ':id': DynamoDBUtil.toValue(computed.idPart.value) } : {})
      }
    };

    try {
      const result = await this.client.query(query);

      if (result.Count && result.Items && result.Items[0]) {
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
        for (const idx of ModelRegistryIndex.getIndices(cls)) {
          if (isModelIndexedIndex(idx)) {
            const safeName = DynamoDBUtil.toSafeName(idx.name);
            const computed = ModelIndexedComputedIndex.get(idx, item).validate({ sort: true });
            switch (idx.type) {
              case 'indexed:keyed': indices[`${safeName}__`] = getKey(computed); break;
              case 'indexed:sorted': {
                indices[`${safeName}__`] = getKey(computed);
                indices[`${safeName}_sort__`] = getSort(computed);
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
            const safeName = DynamoDBUtil.toSafeName(idx.name);
            const computed = ModelIndexedComputedIndex.get(idx, item).validate({ sort: true });
            switch (idx.type) {
              case 'indexed:keyed': {
                indices[`:${safeName}`] = getKey(computed);
                expr.push(`${safeName}__ = :${safeName}`);
                break;
              }
              case 'indexed:sorted': {
                indices[`:${safeName}`] = getKey(computed);
                indices[`:${safeName}_sort`] = getSort(computed);
                expr.push(`${safeName}__ = :${safeName}`);
                expr.push(`${safeName}_sort__ = :${safeName}_sort`);
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
          UpdateExpression: `SET ${[
            'body=:body',
            expiry !== undefined ? `${EXPIRES_ATTRIBUTE}=:expr` : undefined,
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
        TimeToLiveSpecification: { AttributeName: ttlRequired ? EXPIRES_ATTRIBUTE : undefined, Enabled: ttlRequired }
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

  async * list<T extends ModelType>(cls: Class<T>, options?: ModelListOptions): AsyncIterable<T[]> {
    for await (const { items } of this.#scanCollection(cls, (batchSize, lastKey) => this.client.scan({
      TableName: this.#resolveTable(cls),
      ExclusiveStartKey: lastKey,
      Limit: batchSize
    }), options)) {
      yield items;
    }
  }

  // Expiry
  async deleteExpired<T extends ModelType>(_cls: Class<T>): Promise<number> {
    return -1;
  }

  // Indexed
  async getByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(cls: Class<T>, idx: SingleItemIndex<T, K, S>, body: FullKeyedIndexBody<T, K, S>): Promise<T> {
    return this.get(cls, await this.#getIdByIndex(cls, idx, body));
  }

  async deleteByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(cls: Class<T>, idx: SingleItemIndex<T, K, S>, body: FullKeyedIndexBody<T, K, S>): Promise<void> {
    return this.delete(cls, await this.#getIdByIndex(cls, idx, body));
  }

  upsertByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(cls: Class<T>, idx: SingleItemIndex<T, K, S>, body: OptionalId<T>): Promise<T> {
    return ModelIndexedUtil.naiveUpsert(this, cls, idx, body);
  }

  async updateByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(cls: Class<T>, idx: SingleItemIndex<T, K, S>, body: T): Promise<T> {
    return ModelIndexedUtil.naiveUpdate(this, cls, idx, body);
  }

  async updatePartialByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(cls: Class<T>, idx: SingleItemIndex<T, K, S>, body: FullKeyedIndexWithPartialBody<T, K, S>): Promise<T> {
    const item = await ModelCrudUtil.naivePartialUpdate(cls, () => this.getByIndex(cls, idx, castTo(body)), castTo(body));
    return this.update(cls, item);
  }

  async pageByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(
    cls: Class<T>,
    idx: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    options?: ModelPageOptions,
  ): Promise<ModelPageResult<T>> {
    const output: T[] = [];
    const offset = options?.offset ? JSONUtil.fromBase64<Record<string, AttributeValue>>(options.offset) : undefined;
    for await (const { items } of this.#scanIndex(cls, idx, body, { limit: 100, ...options, offset })) {
      output.push(...items);
    }

    let nextOffset;
    if (output.length) {
      const last: T = output.at(-1)!;
      const computed = ModelIndexedComputedIndex.get(idx, last).validate();
      const safeName = DynamoDBUtil.toSafeName(idx.name);
      nextOffset = JSONUtil.toBase64({
        [`${safeName}__`]: getKey(computed),
        [`${safeName}_sort__`]: getSort(computed),
        id: DynamoDBUtil.toValue(last.id)
      });
    }

    return { items: output, nextOffset };
  }

  async * listByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(
    cls: Class<T>,
    idx: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    options?: ModelListOptions
  ): AsyncIterable<T[]> {
    for await (const { items } of this.#scanIndex(cls, idx, body, options)) {
      yield items;
    }
  }

  async suggestByIndex<T extends ModelType,
    S extends SortedIndexSelection<T>,
    K extends KeyedIndexSelection<T>
  >(cls: Class<T>, idx: SortedIndex<T, K, S>, body: KeyedIndexBody<T, K>, prefix: string, options?: ModelIndexedSearchOptions): Promise<T[]> {
    const results: T[] = [];

    const safeName = DynamoDBUtil.toSafeName(idx.name);

    for await (const { items } of this.#scanIndex(cls, idx, body, { limit: 10, ...options },
      (query) => ({
        ...query,
        FilterExpression: `begins_with(${safeName}_sort__, :prefix)`,
        ExpressionAttributeValues: {
          ...query.ExpressionAttributeValues,
          ':prefix': { S: prefix }
        }
      })
    )) {
      results.push(...items);
    }

    return results;
  }
}