import * as fs from 'fs';
import * as mongo from 'mongodb';
import * as util from 'util';
import * as assert from 'assert';

import { AssetService, AssetUtil, Asset } from '@travetto/asset';
import { Suite, Test, BeforeAll, BeforeEach } from '@travetto/test';
import { DependencyRegistry, Injectable } from '@travetto/di';
import { AssetMongoSource } from '../src/service/source';
import { AssetMongoConfig } from '../src/service/config';

const fsStat = util.promisify(fs.stat);

@Injectable({ target: AssetMongoConfig })
class Conf extends AssetMongoConfig {

}

@Injectable()
class Source extends AssetMongoSource {

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
    const client = (service as any).source.mongoClient as mongo.MongoClient;

    await client.db().dropDatabase();
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
}