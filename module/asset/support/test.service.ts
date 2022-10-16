import * as assert from 'assert';

import { PathUtil } from '@travetto/boot';
import { Test, Suite, BeforeAll } from '@travetto/test';
import { Class, ResourceManager } from '@travetto/base';
import { Inject } from '@travetto/di';
import { NotFoundError } from '@travetto/model';
import { InjectableSuite } from '@travetto/di/support/test.suite';
import { ModelSuite } from '@travetto/model/support/test/suite';

import { HashNamingStrategy, AssetService, AssetUtil } from '..';

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
    ResourceManager.addPath(PathUtil.resolveUnix(__dirname, 'resources'));
  }

  @Test()
  async writeBasic() {
    const service = this.assetService;
    const pth = await ResourceManager.findAbsolute('/asset.yml');
    const file = await AssetUtil.fileToAsset(pth);

    const out = await service.upsert(file);
    const metadata = await service.describe(out);
    assert(file.filename === metadata.filename);
  }

  @Test()
  async writeHashed() {
    const service = this.assetService;
    const pth = await ResourceManager.findAbsolute('/asset.yml');
    const file = await AssetUtil.fileToAsset(pth);
    const outHashed = await service.upsert(file, false, new HashNamingStrategy());
    const hash = await AssetUtil.hashFile(pth);
    assert(outHashed.replace(/\//g, '').replace(/[.][^.]+$/, '') === hash);
  }

  @Test()
  async writeAndGet() {
    const service = this.assetService;
    const pth = await ResourceManager.findAbsolute('/asset.yml');
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
    const pth = await ResourceManager.findAbsolute('/asset.yml');
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