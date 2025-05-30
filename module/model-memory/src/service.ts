import { Readable } from 'node:stream';
import { buffer as toBuffer } from 'node:stream/consumers';

import { Class, TimeSpan, DeepPartial, castTo, BlobMeta, ByteRange, BinaryInput, BinaryUtil } from '@travetto/runtime';
import { Injectable } from '@travetto/di';
import { Config } from '@travetto/config';
import {
  ModelType, IndexConfig, ModelCrudSupport, ModelExpirySupport, ModelStorageSupport, ModelIndexedSupport,
  ModelRegistry, NotFoundError, ExistsError, OptionalId, ModelBlobSupport,
  ModelCrudUtil, ModelExpiryUtil, ModelIndexedUtil, ModelStorageUtil, ModelBlobUtil,
} from '@travetto/model';

const ModelBlobNamespace = '__blobs';
const ModelBlobMetaNamespace = `${ModelBlobNamespace}_meta`;

type StoreType = Map<string, Buffer>;

@Config('model.memory')
export class MemoryModelConfig {
  autoCreate?: boolean = true;
  namespace?: string;
  cullRate?: number | TimeSpan;
}

function indexName<T extends ModelType>(cls: Class<T>, idx: IndexConfig<T> | string, suffix?: string): string {
  return [cls.Ⲑid, typeof idx === 'string' ? idx : idx.name, suffix].filter(x => !!x).join(':');
}

function getFirstId(data: Map<string, unknown> | Set<string>, value?: string | number): string | undefined {
  let id: string | undefined;
  if (data instanceof Set) {
    id = data.values().next().value;
  } else {
    id = [...data.entries()].find(([, v]) => value === undefined || v === value)?.[0];
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
    const key = typeof cls === 'string' ? cls : ModelRegistry.getStore(cls);
    if (!this.#store.has(key)) {
      this.#store.set(key, new Map());
    }
    return this.#store.get(key)!;
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
      for (const idx of ModelRegistry.getIndices(cls, ['sorted', 'unsorted'])) {
        const idxName = indexName(cls, idx);
        const { key } = ModelIndexedUtil.computeIndexKey(cls, idx, castTo(item));
        this.#indices[idx.type].get(idxName)?.get(key)?.delete(id);
      }
    } catch (err) {
      if (!(err instanceof NotFoundError)) {
        throw err;
      }
    }
  }

  async #writeIndices<T extends ModelType>(cls: Class<T>, item: T): Promise<void> {
    for (const idx of ModelRegistry.getIndices(cls, ['sorted', 'unsorted'])) {
      const idxName = indexName(cls, idx);
      const { key, sort } = ModelIndexedUtil.computeIndexKey(cls, idx, castTo(item));
      let index = this.#indices[idx.type].get(idxName)?.get(key);

      if (!index) {
        if (!this.#indices[idx.type].has(idxName)) {
          this.#indices[idx.type].set(idxName, new Map());
        }
        if (idx.type === 'sorted') {
          this.#indices[idx.type].get(idxName)!.set(key, index = new Map());
        } else {
          this.#indices[idx.type].get(idxName)!.set(key, index = new Set());
        }
      }

      if (index instanceof Map) {
        index?.set(item.id, +sort!);
      } else {
        index?.add(item.id);
      }
    }
  }

  async #persist<T extends ModelType>(cls: Class<T>, item: T, action: 'remove'): Promise<void>;
  async #persist<T extends ModelType>(cls: Class<T>, item: T, action: 'write'): Promise<T>;
  async #persist<T extends ModelType>(cls: Class<T>, item: T, action: 'write' | 'remove'): Promise<T | void> {
    const store = this.#getStore(cls);
    await this.#removeIndices(cls, item.id);
    if (action === 'write') {
      store.set(item.id, Buffer.from(JSON.stringify(item)));
      await this.#writeIndices(cls, item);
      return item;
    } else {
      store.delete(item.id);
    }
  }

  async #getIdByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<string> {
    const config = ModelRegistry.getIndex(cls, idx, ['sorted', 'unsorted']);
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
    await ModelStorageUtil.registerModelChangeListener(this);
    ModelExpiryUtil.registerCull(this);

    for (const el of ModelRegistry.getClasses()) {
      for (const idx of ModelRegistry.get(el).indices ?? []) {
        switch (idx.type) {
          case 'unique': {
            console.error('Unique indices are not supported for', { cls: el.Ⲑid, idx: idx.name });
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
      const res = await ModelCrudUtil.load(cls, store.get(id)!);
      if (res) {
        if (ModelRegistry.get(cls).expiresAt) {
          if (!ModelExpiryUtil.getExpiryState(cls, res).expired) {
            return res;
          }
        } else {
          return res;
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
      } catch (err) {
        if (!(err instanceof NotFoundError)) {
          throw err;
        }
      }
    }
  }

  // Blob Support
  async upsertBlob(location: string, input: BinaryInput, meta?: BlobMeta, overwrite = true): Promise<void> {
    if (!overwrite && await this.getBlobMeta(location).then(() => true, () => false)) {
      return;
    }

    const [stream, blobMeta] = await ModelBlobUtil.getInput(input, meta);
    const blobs = this.#getStore(ModelBlobNamespace);
    const metaContent = this.#getStore(ModelBlobMetaNamespace);
    metaContent.set(location, Buffer.from(JSON.stringify(blobMeta)));
    blobs.set(location, await toBuffer(stream));
  }

  async getBlob(location: string, range?: ByteRange): Promise<Blob> {
    const blobs = this.#find(ModelBlobNamespace, location, 'notfound');
    let buffer = blobs.get(location)!;
    const final = range ? ModelBlobUtil.enforceRange(range, buffer.length) : undefined;
    if (final) {
      buffer = Buffer.from(buffer.subarray(final.start, final.end + 1));
    }
    const meta = await this.getBlobMeta(location);
    return BinaryUtil.readableBlob(() => Readable.from(buffer), { ...meta, range: final });
  }

  async getBlobMeta(location: string): Promise<BlobMeta> {
    const metaContent = this.#find(ModelBlobMetaNamespace, location, 'notfound');
    const meta: BlobMeta = JSON.parse(metaContent.get(location)!.toString('utf8'));
    return meta;
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

  async updateBlobMeta(location: string, meta: BlobMeta): Promise<void> {
    const metaContent = this.#getStore(ModelBlobMetaNamespace);
    metaContent.set(location, Buffer.from(JSON.stringify(meta), 'utf8'));
  }

  // Expiry
  async deleteExpired<T extends ModelType>(cls: Class<T>): Promise<number> {
    const store = this.#getStore(cls);
    let deleted = 0;
    for (const key of [...store.keys()]) {
      try {
        const res = await ModelCrudUtil.load(cls, store.get(key)!);
        if (ModelExpiryUtil.getExpiryState(cls, res).expired) {
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

  async createModel<T extends ModelType>(cls: Class<T>): Promise<void> {
    for (const idx of ModelRegistry.get(cls).indices ?? []) {
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
    const config = ModelRegistry.getIndex(cls, idx, ['sorted', 'unsorted']);
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