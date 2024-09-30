import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { BinaryUtil, castTo } from '@travetto/runtime';
import { ModelBasicSuite } from '@travetto/model/support/test/basic';
import { ModelCrudSuite } from '@travetto/model/support/test/crud';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism';
import { ModelBlobSuite } from '@travetto/model/support/test/blob';

import { S3ModelConfig } from '../src/config';
import { S3ModelService } from '../src/service';
import { ModelBlobUrlSuite } from '@travetto/model/support/test/blob-url';

@Suite()
export class S3BasicSuite extends ModelBasicSuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;
}

@Suite()
export class S3CrudSuite extends ModelCrudSuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;
}

@Suite()
export class S3ExpirySuite extends ModelExpirySuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;
}

@Suite()
export class S3PolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;
}

@Suite()
export class S3BlobUrlSuite extends ModelBlobUrlSuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;
}

@Suite()
export class S3BlobSuite extends ModelBlobSuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;

  @Test({ timeout: 15000 })
  async largeFile() {
    const service: S3ModelService = castTo(await this.service);
    const buffer = Buffer.alloc(1.5 * service['config'].chunkSize);
    for (let i = 0; i < buffer.length; i++) {
      buffer.writeUInt8(Math.trunc(Math.random() * 255), i);
    }

    const hash = await BinaryUtil.hashInput(buffer);

    await service.upsertBlob(hash, buffer, {
      filename: 'Random.bin',
      contentType: 'binary/octet-stream',
      size: buffer.length,
      hash
    });

    const stream = await service.getBlob(hash);
    const resolved = await BinaryUtil.hashInput(stream);
    assert(resolved === hash);
  }
}