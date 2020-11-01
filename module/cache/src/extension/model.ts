// @file-if @travetto/model
import { ModelService, ModelRegistry } from '@travetto/model';
import { Schema, Text, Long } from '@travetto/schema';

import { CacheEntry } from '../types';
import { CullableCacheSource } from '../source/cullable';
import { CacheSourceUtil } from '../source/util';

@Schema()
export class CacheModel {
  id?: string;
  key: string;
  @Long()
  expiresAt?: number;
  @Text()
  entry: string;
}

/**
 * A cache source backed by @travetto/model
 */
export class ModelCacheSource extends CullableCacheSource {

  constructor(public modelService: ModelService) {
    super();
  }

  postConstruct() {
    // Manually install model on demand
    ModelRegistry.register(CacheModel, {
      indices: [
        { fields: [{ key: 1 }], options: { unique: true } }
      ]
    });
    ModelRegistry.install(CacheModel, { type: 'added', curr: CacheModel });
  }

  async get(key: string) {
    const models = await this.modelService.getAllByQuery(CacheModel, { where: { key } });
    if (models.length) {
      const [model] = models;
      return { ...CacheSourceUtil.readAsSafeJSON(model.entry), expiresAt: model.expiresAt };
    }
  }

  async set(key: string, entry: CacheEntry) {
    // this.cull(); // Don't wait for it

    const cloned = CacheSourceUtil.storeAsSafeJSON(entry);

    await this.modelService.saveOrUpdate(CacheModel,
      CacheModel.from({
        key,
        expiresAt: entry.expiresAt,
        entry: cloned
      }),
      { where: { key } }
    );

    return CacheSourceUtil.readAsSafeJSON(cloned);
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
    await this.modelService.updatePartialByQuery(CacheModel, { where: { key } }, CacheModel.from({
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
