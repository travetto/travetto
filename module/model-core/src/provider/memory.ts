import { Class } from '@travetto/registry';
import { StreamUtil } from '@travetto/boot';
import { Util } from '@travetto/base';
import { Injectable } from '@travetto/di';
import { Config } from '@travetto/config';

import { ModelCrudSupport } from '../service/crud';
import { ModelStreamSupport, StreamMeta } from '../service/stream';
import { ModelType } from '../types/model';
import { ModelExpirySupport } from '../service/expire';
import { ModelRegistry } from '../registry/registry';
import { ModelStorageSupport } from '../service/storage';
import { ModelCrudUtil } from '../internal/service/crud';
import { ModelExpiryUtil } from '../internal/service/expiry';
import { NotFoundError } from '../error/not-found';
import { ExistsError } from '../error/exists';

@Config('model.memory')
export class MemoryModelConfig {
  namespace: string;
}

/**
 * Standard in-memory support
 */
@Injectable()
export class MemoryModelService implements ModelCrudSupport, ModelStreamSupport, ModelExpirySupport, ModelStorageSupport {

  private store = new Map<string, Map<string, Buffer>>();
  private expiry = new Map<string, { expiresAt: number, issuedAt: number }>();

  constructor(private config: MemoryModelConfig) { }

  private getStore<T extends ModelType>(cls: Class<T> | string) {
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

    const store = this.getStore(cls);
    store.set(item.id!, Buffer.from(JSON.stringify(item)));
    return item;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, id: string, item: Partial<T>, view?: string) {
    item = await ModelCrudUtil.naivePartialUpdate(cls, item, view, () => this.get(cls, id));

    const store = this.getStore(cls);
    store.set(item.id!, Buffer.from(JSON.stringify(item)));
    return item as T;
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    const store = this.find(cls, id, 'notfound');
    store.delete(id);
  }

  async * list<T extends ModelType>(cls: Class<T>) {
    for (const id of this.getStore(cls).keys()) {
      const res = await this.get(cls, id).catch(err => { });
      if (res) {
        yield res;
      }
    }
  }

  async upsertStream(id: string, stream: NodeJS.ReadableStream, meta: StreamMeta) {
    const streams = this.getStore('_streams');
    const metas = this.getStore('_streams_meta');
    metas.set(id, Buffer.from(JSON.stringify(meta)));
    streams.set(id, await StreamUtil.streamToBuffer(stream));
  }

  async getStream(id: string) {
    const streams = this.find('_streams', id, 'notfound');
    return StreamUtil.bufferToStream(streams.get(id)!);
  }

  async getStreamMetadata(id: string) {
    const metas = this.find('_streams_meta', id, 'notfound');
    return JSON.parse(metas.get(id)!.toString('utf8')) as StreamMeta;
  }

  async deleteStream(id: string) {
    const streams = this.getStore('_streams');
    const metas = this.getStore('_streams_metas');
    if (streams.has(id)) {
      streams.delete(id);
      metas.delete(id);
    } else {
      throw new NotFoundError('Stream', id);
    }
  }

  async updateExpiry<T extends ModelType>(cls: Class<T>, id: string, ttl: number) {
    this.expiry.set(id, { expiresAt: ModelExpiryUtil.getExpiresAt(ttl).getTime(), issuedAt: Date.now() });
  }

  async getExpiry<T extends ModelType>(cls: Class<T>, id: string) {
    if (!this.expiry.has(id)) {
      throw new NotFoundError('Expiry information', id);
    }
    const { expiresAt, issuedAt } = this.expiry.get(id)!;
    const maxAge = expiresAt - issuedAt;
    const expired = expiresAt < Date.now();
    return { expiresAt, issuedAt, maxAge, expired };
  }

  async upsertWithExpiry<T extends ModelType>(cls: Class<T>, item: T, ttl: number) {
    item = await this.upsert(cls, item);
    await this.updateExpiry(cls, item.id!, ttl);
    return item;
  }

  async deleteExpired<T extends ModelType>(cls: Class<T>) {
    let number = 0;
    for await (const [id, { expiresAt }] of this.expiry.entries()) {
      if (expiresAt < Date.now()) {
        await this.delete(cls, id);
        number += 1;
      }
    }
    return number;
  }

  async createStorage() {
  }

  async deleteStorage() {
    this.expiry.clear();
    this.store.clear();
  }
}