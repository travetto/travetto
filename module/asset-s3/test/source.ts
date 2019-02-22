import * as assert from 'assert';
import * as fs from 'fs';
import * as util from 'util';

import { AssetService, AssetUtil, AssetSource, ImageService } from '@travetto/asset';
import { Suite, BeforeAll, BeforeEach, Test } from '@travetto/test';
import { DependencyRegistry, InjectableFactory } from '@travetto/di';

import { AssetS3Source } from '../src/source';
import { AssetS3Config } from '../src/config';

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

  @Test('downloads an file from a url', { skip: true })
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

    assert.rejects(fsStat(filePath));
  }

  @Test('downloads an file from a url', { skip: true })
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