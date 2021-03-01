import { StreamUtil } from '@travetto/boot';
import { Util, Class } from '@travetto/base';
import { Injectable } from '@travetto/di';
import { Config } from '@travetto/config';

import { ModelCrudSupport } from '../service/crud';
import { ModelStreamSupport, StreamMeta } from '../service/stream';
import { ModelType } from '../types/model';
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

@Config('model.memory')
export class MemoryModelConfig {
  autoCreate?: boolean;
  namespace: string;
  cullRate?: number;
}

/**
 * Standard in-memory support
 */
@Injectable()
export class MemoryModelService implements ModelCrudSupport, ModelStreamSupport, ModelExpirySupport, ModelStorageSupport, ModelIndexedSupport {

  private store = new Map<string, Map<string, Buffer>>();
  private indexes = new Map<string, Map<string, string>>();

  constructor(public readonly config: MemoryModelConfig) { }

  private getStore<T extends ModelType>(cls: Class<T> | string): Map<string, Buffer> {
    const key = typeof cls === 'string' ? cls : ModelRegistry.getStore(cls);
    if (!this.store.has(key)) {
      this.store.set(key, new Map());
    }
    return this.store.get(key)!;
  }

  private find<T extends ModelType>(cls: Class<T> | string, id?: string, errorState?: 'data' | 'notfound') {
    const store = this.getStore(cls);

    if (id && errorState && (errorState === 'notfound' ? !store.has(id) : store.has(id))) {
      throw errorState === 'notfound' ? new NotFoundError(cls, id) : new ExistsError(cls, id);
    }

    return store;
  }

  private async removeIndices<T extends ModelType>(cls: Class<T>, id: string) {
    try {
      const item = await this.get(cls, id);
      for (const idx of ModelRegistry.get(cls).indices ?? []) {
        this.indexes.get(`${cls.ᚕid}:${idx.name}`)?.delete(ModelIndexedUtil.computeIndexKey(cls, idx, item));
      }
    } catch (e) {
      if (!(e instanceof NotFoundError)) {
        throw e;
      }
    }
  }

  private async writeIndices<T extends ModelType>(cls: Class<T>, item: T) {
    for (const idx of ModelRegistry.get(cls).indices ?? []) {
      this.indexes.get(`${cls.ᚕid}:${idx.name}`)?.set(ModelIndexedUtil.computeIndexKey(cls, idx, item), item.id);
    }
  }

  private async write<T extends ModelType>(cls: Class<T>, item: T) {
    const store = this.getStore(cls);
    await this.removeIndices(cls, item.id);
    store.set(item.id, Buffer.from(JSON.stringify(item)));
    await this.writeIndices(cls, item);
    return item;
  }

  postConstruct() {
    ModelStorageUtil.registerModelChangeListener(this);
    ModelExpiryUtil.registerCull(this);
  }

  // CRUD Support
  uuid() {
    return Util.uuid(32);
  }

  async get<T extends ModelType>(cls: Class<T>, id: string) {
    const store = this.getStore(cls);
    if (store.has(id)) {
      const res = await ModelCrudUtil.load(cls, store.get(id)!);
      if (res) {
        return res;
      }
    }
    throw new NotFoundError(cls, id);
  }

  async create<T extends ModelType>(cls: Class<T>, item: T) {
    if (!item.id) {
      item.id = this.uuid();
    }
    this.find(cls, item.id, 'data');
    return await this.upsert(cls, item);
  }

  async update<T extends ModelType>(cls: Class<T>, item: T) {
    this.find(cls, item.id, 'notfound');
    return await this.upsert(cls, item);
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: T) {
    item = await ModelCrudUtil.preStore(cls, item, this);
    return await this.write(cls, item);
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string) {
    const id = item.id;
    const clean = await ModelCrudUtil.naivePartialUpdate(cls, item, view, () => this.get(cls, id));
    return await this.write(cls, clean);
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    const store = this.find(cls, id, 'notfound');
    store.delete(id);
  }

  async * list<T extends ModelType>(cls: Class<T>) {
    for (const id of this.getStore(cls).keys()) {
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
  async upsertStream(location: string, stream: NodeJS.ReadableStream, meta: StreamMeta) {
    const streams = this.getStore('_streams');
    const metas = this.getStore('_streams_meta');
    metas.set(location, Buffer.from(JSON.stringify(meta)));
    streams.set(location, await StreamUtil.streamToBuffer(stream));
  }

  async getStream(location: string) {
    const streams = this.find('_streams', location, 'notfound');
    return StreamUtil.bufferToStream(streams.get(location)!);
  }

  async describeStream(location: string) {
    const metas = this.find('_streams_meta', location, 'notfound');
    return JSON.parse(metas.get(location)!.toString('utf8')) as StreamMeta;
  }

  async deleteStream(location: string) {
    const streams = this.getStore('_streams');
    const metas = this.getStore('_streams_meta');
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
    const store = this.getStore(cls);
    for await (const id of [...store.keys()]) {
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
    this.store.clear();
    this.indexes.clear();
  }

  async createModel(cls: Class<ModelType>) {
    for (const idx of ModelRegistry.get(cls).indices ?? []) {
      this.indexes.set(`${cls.ᚕid}:${idx.name}`, new Map());
    }
  }

  // Indexed
  getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>): Promise<T> {
    const config = ModelRegistry.get(cls).indices!.find(i => i.name === idx);
    if (!config) {
      throw new NotFoundError(cls, `Index ${idx}`);
    }
    const id = ModelIndexedUtil.computeIndexKey(cls, config, body);
    const index = this.indexes.get(`${cls.ᚕid}:${idx}`);
    if (index && index.has(id)) {
      return this.get(cls, index.get(id)!);

    }
    throw new NotFoundError(cls, id);
  }

  async deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>) {
    const config = ModelRegistry.get(cls).indices!.find(i => i.name === idx);
    if (!config) {
      throw new NotFoundError(cls, `Index ${idx}`);
    }
    const id = ModelIndexedUtil.computeIndexKey(cls, config, body);
    const index = this.indexes.get(`${cls.ᚕid}:${idx}`);
    if (index && index.has(id)) {
      index.delete(id);
    }
    throw new NotFoundError(cls, id);
  }
}