import * as assert from 'assert';

import { Test, BeforeAll } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';
import { ResourceManager } from '@travetto/base';

import { HashNamingStrategy, AssetService, AssetUtil } from '..';

export abstract class BaseAssetSourceSuite {

  @BeforeAll()
  async initAll() {
    ResourceManager.addPath(__dirname);
    await DependencyRegistry.init();
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

    await assert.rejects(async () => {
      await service.info(pth);
    });
  }
}