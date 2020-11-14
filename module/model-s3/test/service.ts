import * as assert from 'assert';

import { StreamUtil } from '@travetto/boot';
import { Suite, Test } from '@travetto/test';
import { ModelCrudSuite } from '@travetto/model-core/test/lib/crud';
import { ModelStreamSuite } from '@travetto/model-core/test/lib/stream';
import { S3ModelConfig } from '../src/config';
import { S3ModelService } from '../src/service';

@Suite()
export class S3CrudSuite extends ModelCrudSuite {
  constructor() {
    super(S3ModelService, S3ModelConfig);
  }
}

@Suite()
export class S3StreamSuite extends ModelStreamSuite {
  constructor() {
    super(S3ModelService, S3ModelConfig);
  }

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
      contentType: 'binary/octet-stream',
      size: buffer.length,
      hash
    });

    const stream = await service.getStream(hash);
    const resolved = await this.getHash(stream);
    assert(resolved === hash);
  }
}