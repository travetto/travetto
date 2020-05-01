import * as aws from 'aws-sdk';

import { Suite, BeforeEach, AfterEach } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';
import { Util } from '@travetto/base';
import { BaseAssetSourceSuite } from '@travetto/asset/test/lib/source';

import { S3AssetConfig } from '../src/config';
import { S3AssetSource } from '../src/source';

@Suite()
class AssetSourceSuite extends BaseAssetSourceSuite {

  sourceClass = S3AssetSource;
  configClass = S3AssetConfig;

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
          Objects: (obs.Contents ?? []).map(o => ({ Key: o.Key }))
        }
      } as any).promise();
    }
    await s3.deleteBucket({ Bucket: config.bucket }).promise();
  }
}