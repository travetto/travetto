import * as s3 from '@aws-sdk/client-s3';
import * as assert from 'assert';

import { Suite, BeforeEach, AfterEach, Test } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';
import { Util } from '@travetto/base';
import { BaseAssetSourceSuite } from '@travetto/asset/test/lib/source';

import { S3AssetConfig } from '../src/config';
import { S3AssetSource } from '../src/source';
import { Asset } from '@travetto/asset/src/types';
import { StreamUtil } from '@travetto/boot';

function computeHash(stream: NodeJS.ReadableStream) {
  const hash = require('crypto').createHash('sha256');
  hash.setEncoding('hex');
  return new Promise<string>((resolve) => {
    stream.pipe(hash);
    stream.on('end', () => {
      hash.end();
      resolve(hash.read());
    });
  });
}

@Suite()
class AssetSourceSuite extends BaseAssetSourceSuite {

  sourceClass = S3AssetSource;
  configClass = S3AssetConfig;

  @BeforeEach()
  async init() {
    const config = await DependencyRegistry.getInstance(S3AssetConfig);
    const client = new s3.S3(config);
    const bucket = `trv-${Util.uuid()}`;
    config.bucket = bucket;
    config.postConstruct();

    await client.createBucket({ Bucket: bucket });
  }

  @AfterEach()
  async cleanup() {
    const config = await DependencyRegistry.getInstance(S3AssetConfig);
    const client = new s3.S3(config);
    const obs = await client.listObjects({ Bucket: config.bucket });
    if (obs.Contents && obs.Contents.length) {
      await client.deleteObjects({
        Bucket: config.bucket,
        Delete: {
          Objects: (obs.Contents ?? []).map(o => ({ Key: o.Key }))
        }
      } as any);
    }
    await client.deleteBucket({ Bucket: config.bucket });
  }

  @Test({
    timeout: 15000
  })
  async largeFile() {
    const source = await DependencyRegistry.getInstance(S3AssetSource);
    const buffer = Buffer.alloc(1.5 * source['config'].chunkSize);
    for (let i = 0; i < buffer.length; i++) {
      buffer.writeUInt8(Math.trunc(Math.random() * 255), i);
    }

    const asset: Asset = {
      contentType: 'binary/octet-stream',
      path: '/random-data',
      size: buffer.length,
      stream: await StreamUtil.toStream(buffer),
      metadata: {
        createdDate: new Date(),
        hash: await computeHash(await StreamUtil.bufferToStream(buffer)),
        name: 'random-data',
        title: 'random-data'
      }
    };

    await source.write(asset);
    const stream = await source.read(asset.path);

    const resolved = await computeHash(stream);
    assert(resolved === asset.metadata.hash);
  }
}