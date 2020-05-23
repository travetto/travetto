import * as assert from 'assert';

import { FsUtil } from '@travetto/boot/src';
import { Test, BeforeAll } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';
import { ResourceManager } from '@travetto/base';
import { Class, RootRegistry } from '@travetto/registry';

import { HashNamingStrategy, AssetService, AssetUtil } from '../..';
import { AssetSource } from '../../src/source';

export abstract class BaseAssetSourceSuite {

  abstract get sourceClass(): Class<AssetSource>;
  abstract get configClass(): Class<any>;

  get source() {
    return DependencyRegistry.getInstance(this.sourceClass);
  }

  get service() {
    return DependencyRegistry.getInstance(AssetService);
  }

  get config() {
    return DependencyRegistry.getInstance(this.configClass);
  }

  @BeforeAll()
  async initAll() {
    ResourceManager.addPath(FsUtil.resolveUnix(__dirname, '..'));
    await RootRegistry.init();
    const config = await this.config;
    if ('namespace' in config) {
      config.namespace = `random_${Math.trunc(Math.random() * 10000)}`; // Randomize namespace
    }
  }

  @Test()
  async writeBasic() {
    const service = await this.service;
    const pth = await ResourceManager.toAbsolutePath('/asset.yml');
    const file = await AssetUtil.fileToAsset(pth);

    const out = await service.write(file);
    assert(file.path === out);
  }

  @Test()
  async writeHashed() {
    const service = await this.service;
    const pth = await ResourceManager.toAbsolutePath('/asset.yml');
    const file = await AssetUtil.fileToAsset(pth);
    const outHashed = await service.write(file, false, new HashNamingStrategy());
    const hash = await AssetUtil.hashFile(pth);
    assert(outHashed.replace(/\//g, '') === hash);
  }

  @Test()
  async writeAndGet() {
    const service = await this.service;
    const pth = await ResourceManager.toAbsolutePath('/asset.yml');
    const file = await AssetUtil.fileToAsset(pth);
    await service.write(file);

    const saved = await service.read(pth);

    assert(file.contentType === saved.contentType);
    assert(file.size === saved.size);
    assert.deepStrictEqual(file.metadata, saved.metadata);
  }

  @Test()
  async writeAndDelete() {
    const service = await this.service;
    const pth = await ResourceManager.toAbsolutePath('/asset.yml');
    const file = await AssetUtil.fileToAsset(pth);
    await service.write(file);

    const out = await service.info(pth);

    assert(out.path === pth);

    await service.delete(pth);

    await assert.rejects(async () => {
      await service.info(pth);
    });
  }
}