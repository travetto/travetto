import {
  type Class, type TimeSpan, castTo, type BinaryMetadata,
  type ByteRange, type BinaryType, BinaryUtil, type BinaryArray, JSONUtil, BinaryMetadataUtil,
} from '@travetto/runtime';
import { Injectable, PostConstruct } from '@travetto/di';
import { Config } from '@travetto/config';
import {
  type ModelType, type ModelCrudSupport, type ModelExpirySupport, type ModelStorageSupport, ModelRegistryIndex,
  NotFoundError, ExistsError, type OptionalId, type ModelBlobSupport, ModelCrudUtil, ModelExpiryUtil, ModelStorageUtil,
  IndexNotSupported,
} from '@travetto/model';
import {
  type ModelIndexedSupport, type KeyedIndexSelection, type KeyedIndexBody, type ListPageOptions, ModelIndexedUtil,
  type SingleItemIndex, type SortedIndexSelection, type ListPageResult, type SortedIndex,
  type AllIndexes, isModelIndexedIndex, type FullKeyedIndexBody, type FullKeyedIndexWithPartialBody, ModelIndexedComputedIndex,
} from '@travetto/model-indexed';

const ModelBlobNamespace = '__blobs';
const ModelBlobMetaNamespace = `${ModelBlobNamespace}_meta`;

type StoreType = Map<string, BinaryArray>;

@Config('model.memory')
export class MemoryModelConfig {
  modifyStorage?: boolean = true;
  namespace?: string;
  cullRate?: number | TimeSpan;
}

function indexName<T extends ModelType>(cls: Class<T>, idx: AllIndexes<T>, suffix?: string): string {
  return [cls.Ⲑid, idx.name, suffix].filter(part => !!part).join(':');
}

function getFirstId(data: Map<string, unknown> | Set<string>, value?: string | number): string | undefined {
  let id: string | undefined;
  if (data instanceof Set) {
    id = data.values().next().value;
  } else {
    id = [...data.entries()].find(([, item]) => value === undefined || item === value)?.[0];
  }
  return id;
}

/**
 * Standard in-memory support
 */
@Injectable()
export class MemoryModelService implements
  ModelCrudSupport, ModelBlobSupport,
  ModelExpirySupport, ModelStorageSupport,
  ModelIndexedSupport {

  #store = new Map<string, StoreType>();
  #indices = {
    'indexed:sorted': new Map<string, Map<string, Map<string, number>>>(),
    'indexed:keyed': new Map<string, Map<string, Set<string>>>(),
  } as const;

  idSource = ModelCrudUtil.uuidSource();
  config: MemoryModelConfig;

  constructor(config: MemoryModelConfig) { this.config = config; }

  get client(): Map<string, StoreType> { return this.#store; }

  #getStore<T extends ModelType>(cls: Class<T> | string): StoreType {
    const key = typeof cls === 'string' ? cls : ModelRegistryIndex.getStoreName(cls);
    return this.#store.getOrInsert(key, new Map());
  }

  #find<T extends ModelType>(cls: Class<T> | string, id?: string, errorState?: 'exists' | 'notfound'): StoreType {
    const store = this.#getStore(cls);

    if (id && errorState && (errorState === 'notfound' ? !store.has(id) : store.has(id))) {
      throw errorState === 'notfound' ? new NotFoundError(cls, id) : new ExistsError(cls, id);
    }

    return store;
  }

  async #removeIndices<T extends ModelType>(cls: Class<T>, id: string): Promise<void> {
    try {
      const item = await this.get(cls, id);
      for (const idx of ModelRegistryIndex.getIndices(cls)) {
        if (!isModelIndexedIndex(idx)) {
          continue; // Only support ModelIndexed indices
        }
        const idxName = indexName(cls, idx);
        const computed = ModelIndexedComputedIndex.get(idx, item).validate({ sort: true });
        switch (idx.type) {
          case 'indexed:sorted':
          case 'indexed:keyed': this.#indices[idx.type].get(idxName)?.get(computed.getKey())?.delete(id); break;
        }
      }
    } catch (error) {
      if (!(error instanceof NotFoundError)) {
        throw error;
      }
    }
  }

  async #writeIndices<T extends ModelType>(cls: Class<T>, item: T): Promise<void> {
    for (const idx of ModelRegistryIndex.getIndices(cls)) {
      if (!isModelIndexedIndex(idx)) {
        continue; // Only support ModelIndexed indices
      }
      const idxName = indexName(cls, idx);
      const computed = ModelIndexedComputedIndex.get(idx, item).validate({ sort: true });
      const key = computed.getKey();
      switch (idx.type) {
        case 'indexed:keyed': {
          if (idx.unique) {
            const existing = this.#indices[idx.type].get(idxName)?.get(key);
            if (existing && existing.size > 0 && !existing.has(item.id)) {
              throw new ExistsError(cls, key);
            }
          }
          this.#indices[idx.type].getOrInsert(idxName, new Map()).getOrInsert(key, new Set()).add(item.id);
          break;
        }
        case 'indexed:sorted': {
          this.#indices[idx.type].getOrInsert(idxName, new Map()).getOrInsert(key, new Map()).set(item.id, computed.getSort());
          break;
        }
      }
    }
  }

  async #persist<T extends ModelType>(cls: Class<T>, item: T, action: 'remove'): Promise<void>;
  async #persist<T extends ModelType>(cls: Class<T>, item: T, action: 'write'): Promise<T>;
  async #persist<T extends ModelType>(cls: Class<T>, item: T, action: 'write' | 'remove'): Promise<T | void> {
    const store = this.#getStore(cls);
    await this.#removeIndices(cls, item.id);
    if (action === 'write') {
      store.set(item.id, JSONUtil.toBinaryArray(item));
      await this.#writeIndices(cls, item);
      return item;
    } else {
      store.delete(item.id);
    }
  }

  async #getIdByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(cls: Class<T>, idx: SingleItemIndex<T, K, S>, body: FullKeyedIndexBody<T, K, S>): Promise<string> {
    const computed = ModelIndexedComputedIndex.get(idx, body).validate({ sort: true });

    const index = this.#indices[idx.type].get(indexName(cls, idx))?.get(computed.getKey());
    let id: string | undefined;
    if (index) {
      if (index instanceof Map) {
        id = getFirstId(index, computed.getSort()); // Grab first id
      } else if (index instanceof Set) {
        id = getFirstId(index); // Grab first id
      }
    }
    if (id) {
      return id;
    }
    throw new NotFoundError(cls, computed.getKey({ sort: true }));
  }

  #getIndexIds<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(cls: Class<T>, idx: AllIndexes<T, K, S>, body: KeyedIndexBody<T, K>): string[] {
    const computed = ModelIndexedComputedIndex.get(idx, body).validate({ keyed: true });
    if (!isModelIndexedIndex(idx)) {
      throw new IndexNotSupported(cls, idx, 'Only ModelIndexed indices can be used with MemoryModelService');
    }

    const base = this.#indices[idx.type].get(indexName(cls, idx));
    const index = base?.get(computed.getKey());
    if (!index) {
      return [];
    } else if (index instanceof Map) {
      return [...index.entries()].toSorted((a, b) => a[1] - b[1]).map(([id,]) => id);
    } else {
      return [...index];
    }
  }

  @PostConstruct()
  async initializeClient(): Promise<void> {
    await ModelStorageUtil.storageInitialization(this);
    ModelExpiryUtil.registerCull(this);

    for (const cls of ModelRegistryIndex.getClasses()) {
      for (const idx of Object.values(ModelRegistryIndex.getConfig(cls).indices ?? {})) {
        if (!isModelIndexedIndex(idx)) {
          console.error(`Indices of type ${idx.type} are not supported for`, { cls: cls.Ⲑid, name: idx.name, type: idx.type });
        }
      }
    }
  }

  // CRUD Support
  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    const store = this.#getStore(cls);
    if (store.has(id)) {
      const result = await ModelCrudUtil.load(cls, store.get(id)!);
      if (result) {
        if (ModelRegistryIndex.getConfig(cls).expiresAt) {
          if (!ModelExpiryUtil.getExpiryState(cls, result).expired) {
            return result;
          }
        } else {
          return result;
        }
      }
    }
    throw new NotFoundError(cls, id);
  }

  async create<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    if (!item.id) {
      item.id = this.idSource.create();
    }
    this.#find(cls, item.id, 'exists');
    return await this.upsert(cls, item);
  }

  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    await this.get(cls, item.id);
    return await this.upsert(cls, item);
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    const store = this.#getStore(cls);
    if (item.id && store.has(item.id)) {
      await ModelCrudUtil.load(cls, store.get(item.id)!, 'exists');
    }
    const prepped = await ModelCrudUtil.preStore(cls, item, this);
    return await this.#persist(cls, prepped, 'write');
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string): Promise<T> {
    const id = item.id;
    const clean = await ModelCrudUtil.naivePartialUpdate(cls, () => this.get(cls, id), item, view);
    return await this.#persist(cls, clean, 'write');
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void> {
    const store = this.#getStore(cls);
    if (!store.has(id)) {
      throw new NotFoundError(cls, id);
    }
    await ModelCrudUtil.load(cls, store.get(id)!);
    const where: ModelType = { id };
    await this.#persist(cls, where, 'remove');
  }

  async * list<T extends ModelType>(cls: Class<T>): AsyncIterable<T> {
    for (const id of this.#getStore(cls).keys()) {
      try {
        yield await this.get(cls, id);
      } catch (error) {
        if (!(error instanceof NotFoundError)) {
          throw error;
        }
      }
    }
  }

  // Blob Support
  async upsertBlob(location: string, input: BinaryType, metadata?: BinaryMetadata, overwrite = true): Promise<void> {
    if (!overwrite && await this.getBlobMetadata(location).then(() => true, () => false)) {
      return;
    }
    const resolved = await BinaryMetadataUtil.compute(input, metadata);
    const blobs = this.#getStore(ModelBlobNamespace);
    const metaContent = this.#getStore(ModelBlobMetaNamespace);
    metaContent.set(location, JSONUtil.toBinaryArray(resolved));
    blobs.set(location, await BinaryUtil.toBinaryArray(input));
  }

  async getBlob(location: string, range?: ByteRange): Promise<Blob> {

    const blobs = this.#find(ModelBlobNamespace, location, 'notfound');

    let data = blobs.get(location)!;
    const final = range ? BinaryMetadataUtil.enforceRange(range, { size: data.byteLength }) : undefined;

    if (final) {
      data = BinaryUtil.sliceByteArray(data, final.start, final.end + 1);
    }

    const metadata = await this.getBlobMetadata(location);
    return BinaryMetadataUtil.makeBlob(data, { ...metadata, range: final });
  }

  async getBlobMetadata(location: string): Promise<BinaryMetadata> {
    const metaContent = this.#find(ModelBlobMetaNamespace, location, 'notfound');
    return JSONUtil.fromBinaryArray(metaContent.get(location)!);
  }

  async deleteBlob(location: string): Promise<void> {
    const blobs = this.#getStore(ModelBlobNamespace);
    const metaContent = this.#getStore(ModelBlobMetaNamespace);
    if (blobs.has(location)) {
      blobs.delete(location);
      metaContent.delete(location);
    } else {
      throw new NotFoundError(ModelBlobNamespace, location);
    }
  }

  async updateBlobMetadata(location: string, metadata: BinaryMetadata): Promise<void> {
    const metaContent = this.#getStore(ModelBlobMetaNamespace);
    metaContent.set(location, JSONUtil.toBinaryArray(metadata));
  }

  // Expiry
  async deleteExpired<T extends ModelType>(cls: Class<T>): Promise<number> {
    const store = this.#getStore(cls);
    let deleted = 0;
    for (const key of [...store.keys()]) {
      try {
        const result = await ModelCrudUtil.load(cls, store.get(key)!);
        if (ModelExpiryUtil.getExpiryState(cls, result).expired) {
          store.delete(key);
          deleted += 1;
        }
      } catch { } // Do not let a single error stop the process
    }
    return deleted;
  }

  // Storage Support
  async createStorage(): Promise<void> {
  }

  async deleteStorage(): Promise<void> {
    this.#store.clear();
    for (const value of Object.values(this.#indices)) {
      value.clear();
    }
  }

  async upsertModel<T extends ModelType>(cls: Class<T>): Promise<void> {
    for (const idx of ModelRegistryIndex.getIndices(cls)) {
      if (isModelIndexedIndex(idx)) {
        this.#indices[idx.type].set(indexName(cls, idx), new Map());
      }
    }
  }

  async truncateModel<T extends ModelType>(cls: Class<T>): Promise<void> {
    this.#getStore(cls).clear();
  }

  async truncateBlob(): Promise<void> {
    this.#getStore(ModelBlobNamespace).clear();
    this.#getStore(ModelBlobMetaNamespace).clear();
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
    await this.delete(cls, await this.#getIdByIndex(cls, idx, body));
  }

  upsertByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(cls: Class<T>, idx: SingleItemIndex<T, K, S>, body: OptionalId<T>): Promise<T> {
    return ModelIndexedUtil.naiveUpsert(this, cls, idx, body);
  }

  updateByIndex<
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

  async listByIndex<
    T extends ModelType,
    K extends KeyedIndexSelection<T>,
    S extends SortedIndexSelection<T>
  >(
    cls: Class<T>,
    idx: SortedIndex<T, K, S>,
    body: KeyedIndexBody<T, K>,
    options?: ListPageOptions
  ): Promise<ListPageResult<T>> {
    const ids = this.#getIndexIds(cls, idx, body);
    const offset = options?.offset ? JSONUtil.fromBase64<number>(options.offset) : 0;
    const limit = options?.limit ?? 100;

    const items: T[] = [];
    for (const id of ids.slice(offset, offset + limit)) {
      items.push(await this.get(cls, id));
    }
    return { items, nextOffset: items.length ? JSONUtil.toBase64(offset + items.length) : undefined };
  }
}