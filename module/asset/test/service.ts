import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { ResourceManager } from '@travetto/base';
import { BaseModelSuite } from '@travetto/model-core/test/lib/test.base';
import { MemoryModelConfig, MemoryModelService, ModelStreamSupport } from '@travetto/model-core';
import { DependencyRegistry, InjectableFactory } from '@travetto/di';

import { HashNamingStrategy, AssetService, AssetUtil } from '..';
import { AssetModelSymbol } from '../src/service';


class Init {
  @InjectableFactory(AssetModelSymbol)
  static modelProvider(config: MemoryModelConfig) {
    return new MemoryModelService(config);
  }
}

@Suite()
export class AssetServiceSuite extends BaseModelSuite<ModelStreamSupport> {

  constructor() {
    super(MemoryModelService, MemoryModelConfig);
  }

  get assetService() {
    return DependencyRegistry.getInstance(AssetService);
  }

  @Test()
  async writeBasic() {
    const service = await this.assetService;
    const pth = await ResourceManager.toAbsolutePath('/asset.yml');
    const file = await AssetUtil.fileToAsset(pth);

    const out = await service.upsert(file);
    const metadata = await service.getMetadata(out);
    assert(file.filename === metadata.filename);
  }

  @Test()
  async writeHashed() {
    const service = await this.assetService;
    const pth = await ResourceManager.toAbsolutePath('/asset.yml');
    const file = await AssetUtil.fileToAsset(pth);
    const outHashed = await service.upsert(file, false, new HashNamingStrategy());
    const hash = await AssetUtil.hashFile(pth);
    assert(outHashed.replace(/\//g, '').replace(/[.][^.]+$/, '') === hash);
  }

  @Test()
  async writeAndGet() {
    const service = await this.assetService;
    const pth = await ResourceManager.toAbsolutePath('/asset.yml');
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
    const pth = await ResourceManager.toAbsolutePath('/asset.yml');
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