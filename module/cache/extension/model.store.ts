import { ModelService, Model } from '@travetto/model';
import { Text } from '@travetto/schema';

import { CullableCacheStore } from '../src/store/types';
import { CacheEntry } from '../src/types';
import { CacheStoreUtil } from '../src/store/util';

@Model()
export class CacheModel {
  id?: string;
  key: string;
  expiresAt?: number;
  @Text()
  entry: string;
}

export class ModelCacheStore extends CullableCacheStore {

  constructor(public modelService: ModelService) {
    super();
  }

  async get(key: string) {
    const model = await this.modelService.getByQuery(CacheModel, { where: { key } });
    return { ...CacheStoreUtil.readAsSafeJSON(model.entry), expiresAt: model.expiresAt };
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