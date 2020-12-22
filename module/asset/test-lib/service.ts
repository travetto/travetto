import * as assert from 'assert';

import { FsUtil } from '@travetto/boot/src';
import { Test, Suite, BeforeAll } from '@travetto/test';
import { ResourceManager } from '@travetto/base';
import { BaseModelSuite } from '@travetto/model-core//test.base';
import { DependencyRegistry } from '@travetto/di';
import { ModelStreamSupport } from '@travetto/model-core';

import { HashNamingStrategy, AssetService, AssetUtil } from '..';

@Suite({ skip: true })
export abstract class AssetServiceSuite extends BaseModelSuite<ModelStreamSupport> {

  get assetService() {
    return DependencyRegistry.getInstance(AssetService);
  }

  @BeforeAll()
  async setup() {
    ResourceManager.addPath(FsUtil.resolveUnix(__dirname, '..'));
  }

  @Test()
  async writeBasic() {
    const service = await this.assetService;
    const pth = await ResourceManager.findAbsolute('/asset.yml');
    const file = await AssetUtil.fileToAsset(pth);

    const out = await service.upsert(file);
    const metadata = await service.getMetadata(out);
    assert(file.filename === metadata.filename);
  }

  @Test()
  async writeHashed() {
    const service = await this.assetService;
    const pth = await ResourceManager.findAbsolute('/asset.yml');
    const file = await AssetUtil.fileToAsset(pth);
    const outHashed = await service.upsert(file, false, new HashNamingStrategy());
    const hash = await AssetUtil.hashFile(pth);
    assert(outHashed.replace(/\//g, '').replace(/[.][^.]+$/, '') === hash);
  }

  @Test()
  async writeAndGet() {
    const service = await this.assetService;
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
    const service = await this.assetService;
    const pth = await ResourceManager.findAbsolute('/asset.yml');
    const file = await AssetUtil.fileToAsset(pth);
    const id = await service.upsert(file);

    const out = await service.getMetadata(id);

    assert(out.filename === id);

    await service.delete(id);

    await assert.rejects(async () => {
      await service.getMetadata(id);
    });
  }
}