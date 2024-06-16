import fs from 'node:fs/promises';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { buffer as toBuffer } from 'node:stream/consumers';

import { Suite, Test, TestFixtures } from '@travetto/test';

import { BaseModelSuite } from './base';
import { ModelStreamSupport } from '../../src/service/stream';

@Suite()
export abstract class ModelStreamSuite extends BaseModelSuite<ModelStreamSupport> {

  fixture = new TestFixtures(['@travetto/model']);

  async getHash(stream: Readable): Promise<string> {
    const hasher = crypto.createHash('sha1').setEncoding('hex');
    await pipeline(stream, hasher);
    return hasher.read().toString();
  }

  async getStream(resource: string): Promise<readonly [{ size: number, contentType: string, hash: string, filename: string }, Readable]> {
    const file = await this.fixture.resolve(resource);
    const { size } = await fs.stat(file);
    const hash = await this.getHash(await this.fixture.readStream(resource));

    return [
      { size, contentType: '', hash, filename: resource },
      await this.fixture.readStream(resource)
    ] as const;
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

  @Test()
  async partialStream(): Promise<void> {
    const service = await this.service;
    const [meta, stream] = await this.getStream('/text.txt');

    await service.upsertStream(meta.hash, stream, meta);

    const retrieved = await service.getStream(meta.hash);
    const content = (await toBuffer(retrieved)).toString('utf8');
    assert(content.startsWith('abc'));
    assert(content.endsWith('xyz'));

    const partial = await service.getStreamPartial(meta.hash, 10, 20);
    const subContent = (await toBuffer(partial.stream)).toString('utf8');
    assert(subContent.length === (partial.range[1] - partial.range[0]) + 1);
    assert(subContent === 'klmnopqrstu');

    const partialUnbounded = await service.getStreamPartial(meta.hash, 10);
    const subContent2 = (await toBuffer(partialUnbounded.stream)).toString('utf8');
    assert(subContent2.length === (partialUnbounded.range[1] - partialUnbounded.range[0]) + 1);
    assert(subContent2.startsWith('klm'));
    assert(subContent2.endsWith('xyz'));

    const partialSingle = await service.getStreamPartial(meta.hash, 10, 10);
    const subContent3 = (await toBuffer(partialSingle.stream)).toString('utf8');
    assert(subContent3.length === 1);
    assert(subContent3 === 'k');

    const partialOverbounded = await service.getStreamPartial(meta.hash, 20, 40);
    const subContent4 = (await toBuffer(partialOverbounded.stream)).toString('utf8');
    assert(subContent4.length === 6);
    assert(subContent4.endsWith('xyz'));

    await assert.rejects(() => service.getStreamPartial(meta.hash, -10, 10));
    await assert.rejects(() => service.getStreamPartial(meta.hash, 30, 37));
  }
}