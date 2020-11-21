import * as assert from 'assert';
import * as fs from 'fs';
import * as crypto from 'crypto';

import { FsUtil } from '@travetto/boot';
import { BeforeAll, Suite, Test } from '@travetto/test';
import { ResourceManager } from '@travetto/base';

import { BaseModelSuite } from './test.base';
import { ModelStreamSupport } from '../../src/service/stream';

@Suite({ skip: true })
export abstract class ModelStreamSuite extends BaseModelSuite<ModelStreamSupport> {

  async getHash(stream: NodeJS.ReadableStream) {
    const hash = crypto.createHash('sha1');
    hash.setEncoding('hex');
    await new Promise((res, rej) => {
      stream.on('end', res);
      stream.on('error', rej);
      stream.pipe(hash);
    });
    return hash.read() as string;
  }

  async getStream(resource: string) {
    const file = await ResourceManager.toAbsolutePath(resource);
    const stat = await fs.promises.stat(file);
    const hash = await this.getHash(fs.createReadStream(file));

    return [
      { size: stat.size, contentType: '', hash, filename: resource },
      fs.createReadStream(file)
    ] as const;
  }


  @BeforeAll()
  async beforeAll() {
    ResourceManager.addPath(FsUtil.resolveUnix(__dirname, '..'));
  }

  @Test()
  async writeBasic() {
    const service = await this.service;
    const [meta, stream] = await this.getStream('/asset.yml');

    await service.upsertStream(meta.hash, stream, meta);

    const retrieved = await service.getStreamMetadata(meta.hash);
    assert(meta === retrieved);
  }

  @Test()
  async writeStream() {
    const service = await this.service;
    const [meta, stream] = await this.getStream('/asset.yml');

    await service.upsertStream(meta.hash, stream, meta);

    const retrieved = await service.getStream(meta.hash);
    assert(await this.getHash(retrieved) === meta.hash);
  }

  @Test()
  async writeAndDelete() {
    const service = await this.service;
    const [meta, stream] = await this.getStream('/asset.yml');

    await service.upsertStream(meta.hash, stream, meta);

    await service.deleteStream(meta.hash);

    await assert.rejects(async () => {
      await service.getStream(meta.hash);
    });
  }
}