import { StreamUtil } from '@travetto/boot';
import { Util, Class, TimeSpan } from '@travetto/base';
import { DeepPartial } from '@travetto/schema';
import { Injectable } from '@travetto/di';
import { Config } from '@travetto/config';

import { ModelCrudSupport } from '../service/crud';
import { ModelStreamSupport, StreamMeta } from '../service/stream';
import { ModelType, OptionalId } from '../types/model';
import { ModelExpirySupport } from '../service/expiry';
import { ModelRegistry } from '../registry/model';
import { ModelStorageSupport } from '../service/storage';
import { ModelCrudUtil } from '../internal/service/crud';
import { ModelExpiryUtil } from '../internal/service/expiry';
import { NotFoundError } from '../error/not-found';
import { ExistsError } from '../error/exists';
import { ModelIndexedSupport } from '../service/indexed';
import { ModelIndexedUtil } from '../internal/service/indexed';
import { ModelStorageUtil } from '../internal/service/storage';
import { StreamModel, STREAMS } from '../internal/service/stream';
import { IndexConfig } from '../registry/types';

const STREAM_META = `${STREAMS}_meta`;

@Config('model.memory')
export class MemoryModelConfig {
  autoCreate?: boolean;
  namespace?: string;
  cullRate?: number | TimeSpan;
}

function indexName<T extends ModelType>(cls: Class<T>, idx: IndexConfig<T> | string, suffix?: string) {
  return [cls.ᚕid, typeof idx === 'string' ? idx : idx.name, suffix].filter(x => !!x).join(':');
}

function getFirstId(data: Map<string, unknown> | Set<string>, value?: string | number) {
  let id: string | undefined;
  if (data instanceof Set) {
    id = data.values().next().value as string;
  } else {
    id = [...data.entries()].find(([k, v]) => value === undefined || v === value)?.[0];
  }
  return id;
}

/**
 * Standard in-memory support
 */
@Injectable()
export class MemoryModelService implements ModelCrudSupport, ModelStreamSupport, ModelExpirySupport, ModelStorageSupport, ModelIndexedSupport {

  #store = new Map<string, Map<string, Buffer>>();
  #indices = {
    sorted: new Map<string, Map<string, Map<string, number>>>(),
    unsorted: new Map<string, Map<string, Set<string>>>()
  };
  get client() { return this.#store; }

  constructor(public readonly config: MemoryModelConfig) { }

  #getStore<T extends ModelType>(cls: Class<T> | string): Map<string, Buffer> {
    const key = typeof cls === 'string' ? cls : ModelRegistry.getStore(cls);
    if (!this.#store.has(key)) {
      this.#store.set(key, new Map());
    }
    return this.#store.get(key)!;
  }

  #find<T extends ModelType>(cls: Class<T> | string, id?: string, errorState?: 'data' | 'notfound') {
    const store = this.#getStore(cls);

    if (id && errorState && (errorState === 'notfound' ? !store.has(id) : store.has(id))) {
      throw errorState === 'notfound' ? new NotFoundError(cls, id) : new ExistsError(cls, id);
    }

    return store;
  }

  async #removeIndices<T extends ModelType>(cls: Class<T>, id: string) {
    try {
      const item = await this.get(cls, id);
      for (const idx of ModelRegistry.getIndices(cls, ['sorted', 'unsorted'])) {
        const idxName = indexName(cls, idx);
        const { key } = ModelIndexedUtil.computeIndexKey(cls, idx, item as DeepPartial<T>);
        this.#indices[idx.type].get(idxName)?.get(key)?.delete(id);
      }
    } catch (e) {
      if (!(e instanceof NotFoundError)) {
        throw e;
      }
    }
  }

  async #writeIndices<T extends ModelType>(cls: Class<T>, item: T) {
    for (const idx of ModelRegistry.getIndices(cls, ['sorted', 'unsorted'])) {
      const idxName = indexName(cls, idx);
      const { key, sort } = ModelIndexedUtil.computeIndexKey(cls, idx, item as DeepPartial<T>);
      let index = this.#indices[idx.type].get(idxName)?.get(key);

      if (!index) {
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

  async #write<T extends ModelType>(cls: Class<T>, item: T, action: 'remove'): Promise<void>;
  async #write<T extends ModelType>(cls: Class<T>, item: T, action: 'write'): Promise<T>;
  async #write<T extends ModelType>(cls: Class<T>, item: T, action: 'write' | 'remove') {
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

  async postConstruct() {
    await ModelStorageUtil.registerModelChangeListener(this);
    ModelExpiryUtil.registerCull(this);

    for (const el of ModelRegistry.getClasses()) {
      for (const idx of ModelRegistry.get(el).indices ?? []) {
        switch (idx.type) {
          case 'unique': {
            console.error('Unique inidices are not supported for', { cls: el.ᚕid, idx: idx.name });
            break;
          }
        }
      }
    }
  }

  // CRUD Support
  uuid() {
    return Util.uuid(32);
  }

  async get<T extends ModelType>(cls: Class<T>, id: string) {
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

  async create<T extends ModelType>(cls: Class<T>, item: OptionalId<T>) {
    if (!item.id) {
      item.id = this.uuid();
    }
    this.#find(cls, item.id, 'data');
    return await this.upsert(cls, item);
  }

  async update<T extends ModelType>(cls: Class<T>, item: T) {
    await this.get(cls, item.id);
    return await this.upsert(cls, item);
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>) {
    const store = this.#getStore(cls);
    if (item.id && store.has(item.id)) {
      await ModelCrudUtil.load(cls, store.get(item.id)!, 'exists');
    }
    const prepped = await ModelCrudUtil.preStore(cls, item, this);
    return await this.#write(cls, prepped, 'write');
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string) {
    const id = item.id;
    const clean = await ModelCrudUtil.naivePartialUpdate(cls, item, view, () => this.get(cls, id));
    return await this.#write(cls, clean, 'write');
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    const store = this.#getStore(cls);
    if (!store.has(id)) {
      throw new NotFoundError(cls, id);
    }
    await ModelCrudUtil.load(cls, store.get(id)!);
    await this.#write(cls, { id } as T, 'remove');
  }

  async * list<T extends ModelType>(cls: Class<T>) {
    for (const id of this.#getStore(cls).keys()) {
      try {
        yield await this.get(cls, id);
      } catch (e) {
        if (!(e instanceof NotFoundError)) {
          throw e;
        }
      }
    }
  }

  // Stream Support
  async upsertStream(location: string, input: NodeJS.ReadableStream, meta: StreamMeta) {
    const streams = this.#getStore(STREAMS);
    const metas = this.#getStore(STREAM_META);
    metas.set(location, Buffer.from(JSON.stringify(meta)));
    streams.set(location, await StreamUtil.streamToBuffer(input));
  }

  async getStream(location: string) {
    const streams = this.#find(STREAMS, location, 'notfound');
    return StreamUtil.bufferToStream(streams.get(location)!);
  }

  async describeStream(location: string) {
    const metas = this.#find(STREAM_META, location, 'notfound');
    return JSON.parse(metas.get(location)!.toString('utf8')) as StreamMeta;
  }

  async deleteStream(location: string) {
    const streams = this.#getStore(STREAMS);
    const metas = this.#getStore(STREAM_META);
    if (streams.has(location)) {
      streams.delete(location);
      metas.delete(location);
    } else {
      throw new NotFoundError('Stream', location);
    }
  }

  // Expiry Support
  async deleteExpired<T extends ModelType>(cls: Class<T>) {
    const deleting = [];
    const store = this.#getStore(cls);
    for (const id of [...store.keys()]) {
      if ((ModelExpiryUtil.getExpiryState(cls, await this.get(cls, id))).expired) {
        deleting.push(this.delete(cls, id));
      }
    }
    return (await Promise.all(deleting)).length;
  }

  // Storage Support
  async createStorage() {
  }

  async deleteStorage() {
    this.#store.clear();
    this.#indices.sorted.clear();
    this.#indices.unsorted.clear();
  }


  async createModel<T extends ModelType>(cls: Class<T>) {
    for (const idx of ModelRegistry.get(cls).indices ?? []) {
      if (idx.type === 'sorted' || idx.type === 'unsorted') {
        this.#indices[idx.type].set(indexName(cls, idx), new Map());
      }
    }
  }

  async truncateModel<T extends ModelType>(cls: Class<T>) {
    if (cls === StreamModel) {
      this.#getStore(STREAMS).clear();
      this.#getStore(STREAM_META).clear();
    } else {
      this.#getStore(cls).clear();
    }
  }

  // Indexed
  async getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<T> {
    return this.get(cls, await this.#getIdByIndex(cls, idx, body));
  }

  async deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>) {
    await this.delete(cls, await this.#getIdByIndex(cls, idx, body));
  }

  upsertByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: OptionalId<T>): Promise<T> {
    return ModelIndexedUtil.naiveUpsert(this, cls, idx, body);
  }

  async * listByIndex<T extends ModelType>(cls: Class<T>, idx: string, body?: DeepPartial<T>): AsyncGenerator<T> {
    const config = ModelRegistry.getIndex(cls, idx, ['sorted', 'unsorted']);
    const { key } = ModelIndexedUtil.computeIndexKey(cls, idx, body, { emptySortValue: null });
    const index = this.#indices[config.type].get(indexName(cls, idx))?.get(key);

    if (index) {
      if (index instanceof Set) {
        for (const id of index) {
          yield this.get(cls, id);
        }
      } else {
        for (const id of [...index.entries()].sort((a, b) => +a[1] - +b[1]).map(([a, b]) => a)) {
          yield this.get(cls, id);
        }
      }
    }
  }
}