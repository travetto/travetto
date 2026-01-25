import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { BinaryUtil, castTo } from '@travetto/runtime';
import { S3ModelConfig, S3ModelService } from '@travetto/model-s3';

import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';
import { ModelCrudSuite } from '@travetto/model/support/test/crud.ts';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry.ts';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism.ts';
import { ModelBlobSuite } from '@travetto/model/support/test/blob.ts';

@Suite()
class S3BasicSuite extends ModelBasicSuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;
}

@Suite()
class S3CrudSuite extends ModelCrudSuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;
}

@Suite()
class S3ExpirySuite extends ModelExpirySuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;
}

@Suite()
class S3PolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;
}

@Suite()
class S3BlobSuite extends ModelBlobSuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;

  @Test({ timeout: 15000 })
  async largeFile() {
    const service: S3ModelService = castTo(await this.service);
    const buffer = BinaryUtil.fromUTF8String('A'.repeat(1.5 * service['config'].chunkSize));
    for (let i = 0; i < buffer.byteLength; i++) {
      buffer.writeUInt8(Math.trunc(Math.random() * 255), i);
    }

    const hash = await BinaryUtil.hashInput(buffer);

    await service.upsertBlob(hash, buffer, {
      filename: 'Random.bin',
      contentType: 'binary/octet-stream',
      size: buffer.byteLength,
      hash
    });

    const stream = await service.getBlob(hash);
    const resolved = await BinaryUtil.hashInput(stream);
    assert(resolved === hash);
  }
}