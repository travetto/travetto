import * as assert from 'assert';

import { StreamUtil } from '@travetto/base';
import { Suite, Test } from '@travetto/test';

import { ModelBasicSuite } from '@travetto/model/support/test/basic';
import { ModelCrudSuite } from '@travetto/model/support/test/crud';
import { ModelStreamSuite } from '@travetto/model/support/test/stream';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism';

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
export class S3StreamSuite extends ModelStreamSuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;

  @Test({
    timeout: 15000
  })
  async largeFile() {
    const service = (await this.service) as S3ModelService;
    const buffer = Buffer.alloc(1.5 * service['config'].chunkSize);
    for (let i = 0; i < buffer.length; i++) {
      buffer.writeUInt8(Math.trunc(Math.random() * 255), i);
    }

    const hash = await this.getHash(await StreamUtil.bufferToStream(buffer));

    await service.upsertStream(hash, await StreamUtil.bufferToStream(buffer), {
      filename: 'Random.bin',
      contentType: 'binary/octet-stream',
      size: buffer.length,
      hash
    });

    const stream = await service.getStream(hash);
    const resolved = await this.getHash(stream);
    assert(resolved === hash);
  }
}