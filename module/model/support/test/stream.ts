import * as assert from 'assert';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import * as crypto from 'crypto';
import { Readable } from 'stream';

import { PathUtil } from '@travetto/boot';
import { BeforeAll, Suite, Test } from '@travetto/test';
import { ResourceManager } from '@travetto/base';

import { BaseModelSuite } from './base';
import { ModelStreamSupport } from '../../src/service/stream';

@Suite()
export abstract class ModelStreamSuite extends BaseModelSuite<ModelStreamSupport> {

  async getHash(stream: Readable): Promise<string> {
    const hash = crypto.createHash('sha1');
    hash.setEncoding('hex');
    await new Promise((res, rej) => {
      stream.on('end', res);
      stream.on('error', rej);
      stream.pipe(hash);
    });
    return hash.read() as string;
  }

  async getStream(resource: string): Promise<readonly [{ size: number, contentType: string, hash: string, filename: string }, Readable]> {
    const file = await ResourceManager.findAbsolute(resource);
    const stat = await fs.stat(file);
    const hash = await this.getHash(createReadStream(file));

    return [
      { size: stat.size, contentType: '', hash, filename: resource },
      createReadStream(file)
    ] as const;
  }

  @BeforeAll()
  async beforeAll(): Promise<void> {
    ResourceManager.addPath(PathUtil.resolveUnix(__source.originalFolder, '..', 'resources'));
  }

  @Test()
  async writeBasic(): Promise<void> {
    const service = await this.service;
    const [meta, stream] = await this.getStream('/asset.yml');

    await service.upsertStream(meta.hash, stream, meta);

    const retrieved = await service.describeStream(meta.hash);
    assert(meta === retrieved);
  }

  @Test()
  async writeStream(): Promise<void> {
    const service = await this.service;
    const [meta, stream] = await this.getStream('/asset.yml');

    await service.upsertStream(meta.hash, stream, meta);

    const retrieved = await service.getStream(meta.hash);
    assert(await this.getHash(retrieved) === meta.hash);
  }

  @Test()
  async writeAndDelete(): Promise<void> {
    const service = await this.service;
    const [meta, stream] = await this.getStream('/asset.yml');

    await service.upsertStream(meta.hash, stream, meta);

    await service.deleteStream(meta.hash);

    await assert.rejects(async () => {
      await service.getStream(meta.hash);
    });
  }
}