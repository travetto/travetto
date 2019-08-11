import * as aws from 'aws-sdk';
import * as assert from 'assert';

import { HashNamingStrategy, AssetService, AssetUtil } from '@travetto/asset';
import { Suite, Test, BeforeEach, AfterEach, BeforeAll } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';
import { ResourceManager, Util } from '@travetto/base';

// tslint:disable-next-line: no-import-side-effect
import '../';
import { S3AssetConfig } from '../src/config';

@Suite()
class AssetSourceSuite {

  @BeforeAll()
  async initAll() {
    await DependencyRegistry.init();
  }

  @BeforeEach()
  async init() {
    const config = await DependencyRegistry.getInstance(S3AssetConfig);
    const s3 = new aws.S3(config);
    const bucket = `trv-${Util.uuid()}`;
    config.bucket = bucket;
    config.postConstruct();

    await s3.createBucket({ Bucket: bucket }).promise();
  }

  @AfterEach()
  async cleanup() {
    const config = await DependencyRegistry.getInstance(S3AssetConfig);
    const s3 = new aws.S3(config);
    const obs = await s3.listObjects({ Bucket: config.bucket }).promise();
    if (obs.Contents && obs.Contents.length) {
      await s3.deleteObjects({
        Bucket: config.bucket,
        Delete: {
          Objects: (obs.Contents || []).map(o => ({ Key: o.Key }))
        }
      } as any).promise();
    }
    await s3.deleteBucket({ Bucket: config.bucket }).promise();
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