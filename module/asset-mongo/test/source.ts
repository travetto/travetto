import * as assert from 'assert';

import { Suite, Test, BeforeAll, BeforeEach } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';

import { AssetUtil, AssetService, HashNamingStrategy } from '@travetto/asset';
import { ResourceManager } from '@travetto/base';

// tslint:disable-next-line: no-import-side-effect
import '../';
import { MongoAssetSource } from '../src/source';

@Suite()
class AssetSourceSuite {

  @BeforeAll()
  async init() {
    await DependencyRegistry.init();
  }

  @BeforeEach()
  async resetDb() {
    const source = await DependencyRegistry.getInstance(MongoAssetSource);
    await source['mongoClient'].db().dropDatabase();
  }

  @Test()
  async saveBasic() {
    const service = await DependencyRegistry.getInstance(AssetService);
    const pth = await ResourceManager.toAbsolutePath('/asset.yml');
    const file = await AssetUtil.fileToAsset(pth);

    const out = await service.save(file);
    assert(file.path === out);
  }

  @Test()
  async saveHashed() {
    const service = await DependencyRegistry.getInstance(AssetService);
    const pth = await ResourceManager.toAbsolutePath('/asset.yml');
    const file = await AssetUtil.fileToAsset(pth);
    const outHashed = await service.save(file, false, new HashNamingStrategy());
    const hash = await AssetUtil.hashFile(pth);
    assert(outHashed.replace(/\//g, '') === hash);
  }

  @Test()
  async saveAndGet() {
    const service = await DependencyRegistry.getInstance(AssetService);
    const pth = await ResourceManager.toAbsolutePath('/asset.yml');
    const file = await AssetUtil.fileToAsset(pth);
    await service.save(file);

    const saved = await service.get(pth);

    assert(file.contentType === saved.contentType);
    assert(file.size === saved.size);
    assert.deepStrictEqual(file.metadata, saved.metadata);
  }

  @Test()
  async saveAndRemove() {
    const service = await DependencyRegistry.getInstance(AssetService);
    const pth = await ResourceManager.toAbsolutePath('/asset.yml');
    const file = await AssetUtil.fileToAsset(pth);
    await service.save(file);

    const out = await service.info(pth);

    assert(out.path === pth);

    await service.remove(pth);

    await assert.rejects(() => service.info(pth));
  }
}