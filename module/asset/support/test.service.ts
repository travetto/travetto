import * as assert from 'assert';

import { Test, Suite, BeforeAll, TestFixtures } from '@travetto/test';
import { Class, Resources } from '@travetto/base';
import { Inject } from '@travetto/di';
import { NotFoundError } from '@travetto/model';
import { InjectableSuite } from '@travetto/di/support/test.suite';
import { ModelSuite } from '@travetto/model/support/test/suite';

import { HashNamingStrategy, AssetService, AssetUtil } from '../index';

@Suite()
@ModelSuite()
@InjectableSuite()
export abstract class AssetServiceSuite {

  @Inject()
  assetService: AssetService;

  serviceClass: Class;
  configClass: Class;

  @BeforeAll()
  async setup() {
    Resources.getProvider(TestFixtures).addModule('@travetto/asset');
  }

  @Test()
  async writeBasic() {
    const service = this.assetService;
    const { path: pth } = await Resources.describe('test:/asset.yml');
    const file = await AssetUtil.fileToAsset(pth);

    const out = await service.upsert(file);
    const metadata = await service.describe(out);
    assert(file.filename === metadata.filename);
  }

  @Test()
  async writeHashed() {
    const service = this.assetService;
    const { path: pth } = await Resources.describe('test:/asset.yml');
    const file = await AssetUtil.fileToAsset(pth);
    const outHashed = await service.upsert(file, false, new HashNamingStrategy());
    const hash = await AssetUtil.hashFile(pth);
    assert(outHashed.replace(/\//g, '').replace(/[.][^.]+$/, '') === hash);
  }

  @Test()
  async writeAndGet() {
    const service = this.assetService;
    const { path: pth } = await Resources.describe('test:/asset.yml');
    const file = await AssetUtil.fileToAsset(pth);
    await service.upsert(file);

    const saved = await service.get(pth);

    assert(file.contentType === saved.contentType);
    assert(file.size === saved.size);
    assert(file.filename === saved.filename);
    assert(file.hash === saved.hash);
  }

  @Test()
  async writeAndDelete() {
    const service = this.assetService;
    const { path: pth } = await Resources.describe('test:/asset.yml');
    const file = await AssetUtil.fileToAsset(pth);
    const loc = await service.upsert(file);

    const out = await service.describe(loc);

    assert(out.filename === loc);

    await service.delete(loc);

    await assert.rejects(async () => {
      await service.describe(loc);
    }, NotFoundError);
  }
}