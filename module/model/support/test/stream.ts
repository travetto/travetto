import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { Readable } from 'stream';

import { BeforeAll, Suite, Test, TestFixtures } from '@travetto/test';
import { Resources } from '@travetto/base';

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
    const { size } = await Resources.describe(`test:${resource}`);
    const hash = await this.getHash(await Resources.readStream(`test:${resource}`));

    return [
      { size, contentType: '', hash, filename: resource },
      await Resources.readStream(`test:${resource}`)
    ] as const;
  }

  @BeforeAll()
  async init() {
    Resources.getProvider(TestFixtures).addModule('@travetto/model');
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