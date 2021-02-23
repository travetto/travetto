import * as redis from 'redis';
import * as util from 'util';

import { Class, ShutdownManager, Util } from '@travetto/base';
import {
  ModelCrudSupport, ModelExpirySupport, ModelRegistry, ModelType, ModelStorageSupport,
  NotFoundError, ExistsError, ModelIndexedSupport
} from '@travetto/model';
import { Injectable } from '@travetto/di';

import { ModelCrudUtil } from '@travetto/model/src/internal/service/crud';
import { ModelExpiryUtil } from '@travetto/model/src/internal/service/expiry';
import { ModelIndexedUtil } from '@travetto/model/src/internal/service/indexed';
import { ModelStorageUtil } from '@travetto/model/src/internal/service/storage';

import { RedisModelConfig } from './config';

/**
 * A model service backed by redis
 */
@Injectable()
export class RedisModelService implements ModelCrudSupport, ModelExpirySupport, ModelStorageSupport, ModelIndexedSupport {

  cl: redis.RedisClient;

  constructor(public readonly config: RedisModelConfig) { }

  private wrap = <T>(fn: T): T => (fn as unknown as Function).bind(this.cl) as T;

  private resolveKey(cls: Class | string, id?: string) {
    let key = typeof cls === 'string' ? cls : ModelRegistry.getStore(cls);
    if (id) {
      key = `${key}:${id}`;
    }
    if (this.config.namespace) {
      key = `${this.config.namespace}/${key}`;
    }
    return key;
  }

  private async * iterate(prefix: Class | string): AsyncIterable<string[]> {
    let prevCursor: string | undefined;
    let done = false;
    const query = `${this.resolveKey(prefix)}*`;

    while (!done) {
      const [cursor, results] = await this.wrap(util.promisify(
        this.cl.scan as
        (cursorNum: string, matchOp: 'MATCH', match: string, countOp: 'COUNT', count: string, cb: redis.Callback<[string, string[]]>) => void
      ))(prevCursor ?? '0', 'MATCH', query, 'COUNT', '100');
      prevCursor = cursor;
      if (results.length) {
        yield results;
      }
      if (cursor === '0') {
        done = true;
      }
    }
  }

  private async store<T extends ModelType>(cls: Class<T>, item: T) {
    const key = this.resolveKey(cls, item.id);
    const config = ModelRegistry.get(cls);
    // Store with indices
    if (config.indices?.length) {
      const multi = this.cl.multi();
      multi.set(key, JSON.stringify(item));

      for (const idx of config.indices) {
        multi.hmset(this.resolveKey(cls, idx.name), ModelIndexedUtil.computeIndexKey(cls, idx, item), item.id!);
      }

      await new Promise<void>((resolve, reject) => multi.exec(err => err ? reject(err) : resolve()));
    } else {
      await this.wrap(util.promisify(this.cl.set))(key, JSON.stringify(item));
    }

    // Set expiry
    if (config.expiresAt) {
      const expiry = ModelExpiryUtil.getExpiryState(cls, item);
      if (expiry.expiresAt !== undefined) {
        if (expiry.expiresAt) {
          await this.wrap(util.promisify(this.cl.pexpireat))(
            this.resolveKey(cls, item.id!), expiry.expiresAt.getTime()
          );
        } else {
          await this.wrap(util.promisify(this.cl.persist))(this.resolveKey(cls, item.id!));
        }
      }
    }
  }

  async postConstruct() {
    this.cl = new redis.RedisClient(this.config.client);
    ModelStorageUtil.registerModelChangeListener(this);
    ShutdownManager.onShutdown(this.constructor.ᚕid, () => this.cl.quit());
  }

  uuid() {
    return Util.uuid(32);
  }

  async has<T extends ModelType>(cls: Class<T>, id: string, error?: 'notfound' | 'data') {
    const res = await this.wrap(util.promisify(this.cl.exists as (key: string, cb: redis.Callback<number>) => void))(this.resolveKey(cls, id));
    if (res === 0 && error === 'notfound') {
      throw new NotFoundError(cls, id);
    } else if (res === 1 && error === 'data') {
      throw new ExistsError(cls, id);
    }
  }

  async get<T extends ModelType>(cls: Class<T>, id: string) {
    const payload = await this.wrap(util.promisify(this.cl.get))(this.resolveKey(cls, id));
    if (payload) {
      const item = await ModelCrudUtil.load(cls, payload);
      if (item) {
        return item;
      }
    }
    throw new NotFoundError(cls, id);
  }

  async create<T extends ModelType>(cls: Class<T>, item: T) {
    if (item.id) {
      await this.has(cls, item.id!, 'data');
    }
    return this.upsert(cls, item);
  }

  async update<T extends ModelType>(cls: Class<T>, item: T) {
    await this.has(cls, item.id!, 'notfound');
    return this.upsert(cls, item);
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: T) {
    item = await ModelCrudUtil.preStore(cls, item, this);
    await this.store(cls, item);
    return item;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, id: string, item: Partial<T>, view?: string) {
    item = await ModelCrudUtil.naivePartialUpdate(cls, item, view, () => this.get(cls, id)) as T;
    await this.store(cls, item);
    return item as T;
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    const count = await this.wrap(util.promisify(this.cl.del as (key: string, cb: redis.Callback<number>) => void))(this.resolveKey(cls, id));
    if (count === 0) {
      throw new NotFoundError(cls, id);
    }
  }

  async * list<T extends ModelType>(cls: Class<T>): AsyncIterable<T> {
    for await (const ids of this.iterate(cls)) {

      const bodies = (await this.wrap(util.promisify(this.cl.mget as (keys: string[], cb: redis.Callback<(string | null)[]>) => void))(ids))
        .filter(x => !!x) as string[];

      for (const body of bodies) {
        try {
          yield await ModelCrudUtil.load(cls, body);
        } catch (e) {
          if (!(e instanceof NotFoundError)) {
            throw e;
          }
        }
      }
    }
  }

  // Expiry
  async deleteExpired<T extends ModelType>(cls: Class<T>) {
    // Automatic
    return -1;
  }

  // Storage
  async createStorage() {
    // Do nothing
  }

  async deleteStorage() {
    if (!this.config.namespace) {
      await this.wrap(util.promisify(this.cl.flushdb))();
    } else {
      for await (const ids of this.iterate('')) {
        if (ids.length) {
          await this.wrap(util.promisify(this.cl.del) as (...keys: string[]) => Promise<number>)(...ids);
        }
      }
    }
  }

  // Indexed
  async getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>) {
    const key = ModelIndexedUtil.computeIndexKey(cls, idx, body);
    const id = await this.wrap(util.promisify(this.cl.hget))(this.resolveKey(cls, idx), key);
    if (id) {
      return this.get(cls, id);
    }
    throw new NotFoundError(`${cls.name}: ${idx}`, ModelIndexedUtil.computeIndexKey(cls, idx, body));
  }

  async deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: Partial<T>) {
    const key = ModelIndexedUtil.computeIndexKey(cls, idx, body);
    const id = await this.wrap(util.promisify(this.cl.hget))(this.resolveKey(cls, idx), key);
    if (id) {
      return this.delete(cls, id);
    }
    throw new NotFoundError(`${cls.name}: ${idx}`, ModelIndexedUtil.computeIndexKey(cls, idx, body));
  }
}