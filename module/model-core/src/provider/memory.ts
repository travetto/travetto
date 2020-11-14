import { Class } from '@travetto/registry';
import { StreamUtil } from '@travetto/boot';
import { AppError, Util } from '@travetto/base';
import { SchemaValidator } from '@travetto/schema';
import { Injectable } from '@travetto/di';

import { ModelCrudSupport } from '../service/crud';
import { ModelStreamSupport, StreamMeta } from '../service/stream';
import { ModelType } from '../types/model';
import { ModelExpirySupport } from '../service/expire';
import { ModelRegistry } from '../registry/registry';
import { Config } from '../../../rest/node_modules/@travetto/config/src/decorator';
import { ModelStorageSupport } from '../service/storage';

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
      throw new AppError(`${typeof cls === 'string' ? cls : cls.name} ${errorState === 'notfound' ? 'not found' : 'found'} with id ${id}`,
        errorState
      );
    }

    return store;
  }

  uuid() {
    return Util.uuid();
  }

  async get<T extends ModelType>(cls: Class<T>, id: string) {
    const optional = await this.getOptional(cls, id);
    if (!optional) {
      throw new AppError(`${cls.name} was not found with id ${id}`, 'notfound');
    }
    return optional;
  }

  async getOptional<T extends ModelType>(cls: Class<T>, id: string) {
    const store = this.getStore(cls);
    if (store.has(id)) {
      const text = JSON.parse(store.get(id)!.toString('utf8'));
      const result = cls.from(text);
      if (result.postLoad) {
        await result.postLoad();
      }
      return result;
    } else {
      return;
    }
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
    if (!item.id) {
      item.id = this.uuid();
    }

    await SchemaValidator.validate(item);

    if (item.prePersist) {
      await item.prePersist();
    }

    const store = this.getStore(cls);
    store.set(item.id!, Buffer.from(JSON.stringify(item)));
    return item;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, id: string, item: Partial<T>, view?: string) {

    if (view) {
      await SchemaValidator.validate(item, view);
    }

    const existing = await this.get(cls, id);

    item = Object.assign(existing, item);

    if (item.prePersist) {
      await item.prePersist();
    }

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
      yield await this.get(cls, id);
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
      return true;
    } else {
      return false;
    }
  }

  async updateExpiry<T extends ModelType>(cls: Class<T>, id: string, ttl: number) {
    if (ttl < 1000000) {
      ttl = Date.now() + ttl;
    }
    this.expiry.set(id, { expiresAt: ttl, issuedAt: Date.now() });
  }

  async getExpiry<T extends ModelType>(cls: Class<T>, id: string) {
    if (!this.expiry.has(id)) {
      throw new AppError(`No expiry information found for ${cls.name} with id ${id}`, 'notfound');
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