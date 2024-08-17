import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { ModelBasicSuite } from '@travetto/model/support/test/basic';
import { ModelCrudSuite } from '@travetto/model/support/test/crud';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism';
import { castTo } from '@travetto/runtime';
import { ModelBlobSuite } from '@travetto/model-blob/support/test/blob';
import { BlobDataUtil, ModelBlobUtil } from '@travetto/model-blob';

import { S3ModelConfig } from '../src/config';
import { S3ModelService } from '../src/service';

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

    const hash = await BlobDataUtil.computeHash(buffer);

    await service.upsertBlob(hash, await ModelBlobUtil.asBlob(new Blob([buffer]), {
      filename: 'Random.bin',
      contentType: 'binary/octet-stream',
      size: buffer.length,
      hash
    }));

    const stream = await service.getBlob(hash);
    const resolved = await BlobDataUtil.computeHash(stream);
    assert(resolved === hash);
  }
}