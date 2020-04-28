// @file-if @travetto/model
import { ModelService, ModelRegistry } from '@travetto/model';
import { Schema, Text, Long } from '@travetto/schema';

import { CacheEntry } from '../types';
import { CullableCacheStore } from '../store/cullable';
import { CacheStoreUtil } from '../store/util';

@Schema()
export class CacheModel {
  id?: string;
  key: string;
  @Long()
  expiresAt?: number;
  @Text()
  entry: string;
}

export class ModelCacheStore extends CullableCacheStore {

  constructor(public modelService: ModelService) {
    super();
  }

  postConstruct() {
    // Manually install model on demand
    ModelRegistry.register(CacheModel, {});
    ModelRegistry.install(CacheModel, { type: 'added', curr: CacheModel });
  }

  async get(key: string) {
    const models = await this.modelService.getAllByQuery(CacheModel, { where: { key } });
    if (models.length) {
      const [model] = models;
      return { ...CacheStoreUtil.readAsSafeJSON(model.entry), expiresAt: model.expiresAt };
    }
  }

  async set(key: string, entry: CacheEntry) {

    const cloned = CacheStoreUtil.storeAsSafeJSON(entry);

    await this.modelService.saveOrUpdate(CacheModel,
      CacheModel.from({
        key,
        expiresAt: entry.expiresAt,
        entry: cloned
      }),
      { where: { key } }
    );

    return CacheStoreUtil.readAsSafeJSON(cloned);
  }

  async has(key: string) {
    const res = await this.modelService.getAllByQuery(CacheModel, { where: { key } });
    return res.length === 1;
  }

  async isExpired(key: string) {
    const expired = await this.modelService.getAllByQuery(CacheModel, {
      where: {
        key,
        expiresAt: { $lt: Date.now() }
      }
    });
    return !!expired.length;
  }

  async touch(key: string, expiresAt: number) {
    await this.modelService.updatePartialByQuery(CacheModel, { where: { key } }, CacheModel.fromRaw({
      key,
      expiresAt
    }));
    return true;
  }

  async delete(key: string) {
    const res = await this.modelService.deleteByQuery(CacheModel, { where: { key } });
    return res === 1;
  }

  async keys() {
    const res = await this.modelService.query(CacheModel, { select: { key: 1 }, limit: 1000 });
    return res.map(x => x.key!);
  }
}