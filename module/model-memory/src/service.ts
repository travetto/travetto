import {
  type Class, type TimeSpan, type DeepPartial, castTo, type BinaryMetadata,
  type ByteRange, type BinaryType, BinaryUtil, type BinaryArray, JSONUtil, BinaryMetadataUtil
} from '@travetto/runtime';
import { Injectable } from '@travetto/di';
import { Config } from '@travetto/config';
import {
  type ModelType, type IndexConfig, type ModelCrudSupport, type ModelExpirySupport, type ModelStorageSupport, type ModelIndexedSupport,
  ModelRegistryIndex, NotFoundError, ExistsError, type OptionalId, type ModelBlobSupport,
  ModelCrudUtil, ModelExpiryUtil, ModelIndexedUtil, ModelStorageUtil
} from '@travetto/model';

const ModelBlobNamespace = '__blobs';
const ModelBlobMetaNamespace = `${ModelBlobNamespace}_meta`;

type StoreType = Map<string, BinaryArray>;

@Config('model.memory')
export class MemoryModelConfig {
  modifyStorage?: boolean = true;
  namespace?: string;
  cullRate?: number | TimeSpan;
}

function indexName<T extends ModelType>(cls: Class<T>, idx: IndexConfig<T> | string, suffix?: string): string {
  return [cls.Ⲑid, typeof idx === 'string' ? idx : idx.name, suffix].filter(part => !!part).join(':');
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
export class MemoryModelService implements ModelCrudSupport, ModelBlobSupport, ModelExpirySupport, ModelStorageSupport, ModelIndexedSupport {

  #store = new Map<string, StoreType>();
  #indices = {
    sorted: new Map<string, Map<string, Map<string, number>>>(),
    unsorted: new Map<string, Map<string, Set<string>>>()
  };

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
      for (const idx of ModelRegistryIndex.getIndices(cls, ['sorted', 'unsorted'])) {
        const idxName = indexName(cls, idx);
        const { key } = ModelIndexedUtil.computeIndexKey(cls, idx, castTo(item));
        this.#indices[idx.type].get(idxName)?.get(key)?.delete(id);
      }
    } catch (error) {
      if (!(error instanceof NotFoundError)) {
        throw error;
      }
    }
  }

  async #writeIndices<T extends ModelType>(cls: Class<T>, item: T): Promise<void> {
    for (const idx of ModelRegistryIndex.getIndices(cls, ['sorted', 'unsorted'])) {
      const idxName = indexName(cls, idx);
      const { key, sort } = ModelIndexedUtil.computeIndexKey(cls, idx, castTo(item));

      if (idx.type === 'sorted') {
        this.#indices[idx.type].getOrInsert(idxName, new Map()).getOrInsert(key, new Map()).set(item.id, +sort!);
      } else {
        this.#indices[idx.type].getOrInsert(idxName, new Map()).getOrInsert(key, new Set()).add(item.id);
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

  async #getIdByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<string> {
    const config = ModelRegistryIndex.getIndex(cls, idx, ['sorted', 'unsorted']);
    const { key, sort } = ModelIndexedUtil.computeIndexKey(cls, config, body);
    const index = this.#indices[config.type].get(indexName(cls, idx))?.get(key);
    let id: string | undefined;
    if (index) {
      if (index instanceof Map) {
        id = getFirstId(index, +sort!); // Grab first id
      } else {
        id = getFirstId(index); // Grab first id
      }
    }
    if (id) {
      return id;
    }
    throw new NotFoundError(cls, key);
  }

  async postConstruct(): Promise<void> {
    await ModelStorageUtil.storageInitialization(this);
    ModelExpiryUtil.registerCull(this);

    for (const cls of ModelRegistryIndex.getClasses()) {
      for (const idx of ModelRegistryIndex.getConfig(cls).indices ?? []) {
        switch (idx.type) {
          case 'unique': {
            console.error('Unique indices are not supported for', { cls: cls.Ⲑid, idx: idx.name });
            break;
          }
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
    this.#indices.sorted.clear();
    this.#indices.unsorted.clear();
  }

  async upsertModel<T extends ModelType>(cls: Class<T>): Promise<void> {
    for (const idx of ModelRegistryIndex.getConfig(cls).indices ?? []) {
      if (idx.type === 'sorted' || idx.type === 'unsorted') {
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
  async getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<T> {
    return this.get(cls, await this.#getIdByIndex(cls, idx, body));
  }

  async deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<void> {
    await this.delete(cls, await this.#getIdByIndex(cls, idx, body));
  }

  upsertByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: OptionalId<T>): Promise<T> {
    return ModelIndexedUtil.naiveUpsert(this, cls, idx, body);
  }

  async * listByIndex<T extends ModelType>(cls: Class<T>, idx: string, body?: DeepPartial<T>): AsyncIterable<T> {
    const config = ModelRegistryIndex.getIndex(cls, idx, ['sorted', 'unsorted']);
    const { key } = ModelIndexedUtil.computeIndexKey(cls, idx, body, { emptySortValue: null });
    const index = this.#indices[config.type].get(indexName(cls, idx))?.get(key);

    if (index) {
      if (index instanceof Set) {
        for (const id of index) {
          yield this.get(cls, id);
        }
      } else {
        for (const id of [...index.entries()].toSorted((a, b) => +a[1] - +b[1]).map(([a,]) => a)) {
          yield this.get(cls, id);
        }
      }
    }
  }
}