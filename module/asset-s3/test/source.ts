import * as fs from 'fs';
import * as util from 'util';
import * as assert from 'assert';

import { AssetService, AssetUtil, Asset, AssetSource, ImageService } from '@travetto/asset';
import { Suite, Test, BeforeAll, BeforeEach } from '@travetto/test';
import { DependencyRegistry, Injectable, InjectableFactory } from '@travetto/di';
import { AssetS3Source } from '../src/service/source';
import { AssetS3Config } from '../src/service/config';

const fsStat = util.promisify(fs.stat);

class Config extends AssetS3Config {
  @InjectableFactory()
  static getConf(): AssetS3Config {
    return new AssetS3Config();
  }
  @InjectableFactory()
  static getSource(cfg: AssetS3Config): AssetSource {
    return new AssetS3Source(cfg);
  }
}

@Suite()
class TestAssetService {

  @BeforeAll()
  async init() {
    await DependencyRegistry.init();
  }

  @BeforeEach()
  async resetDb() {
    const service = await DependencyRegistry.getInstance(AssetService);
  }

  @Test('downloads an file from a url')
  async download() {
    const service = await DependencyRegistry.getInstance(AssetService);
    assert(service);
    assert((service as any).source);

    const filePath = await AssetUtil.downloadUrl('https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png');
    assert(filePath !== undefined);
    assert(filePath.split('.').pop() === 'png');

    let file = await AssetUtil.localFileToAsset(filePath);
    file = await service.save(file);

    assert(file.contentType === 'image/png');
    assert(file.length > 0);

    try {
      await fsStat(filePath);
      assert(false);
    } catch {
      assert(true);
    }
  }

  @Test('downloads an file from a url')
  async downloadAndResize() {
    const service = await DependencyRegistry.getInstance(ImageService);
    const assetService = await DependencyRegistry.getInstance(AssetService);

    const filePath = await AssetUtil.downloadUrl('https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png');
    assert(filePath !== undefined);
    assert(filePath.split('.').pop() === 'png');

    const file = await AssetUtil.localFileToAsset(filePath);
    const done = await assetService.save(file, true);

    assert.ok(done);

    const resized = await service.getImage(file.filename, { w: 40, h: 40 });

    assert(resized.contentType === 'image/png');
    assert.ok(resized.stream);
  }
}