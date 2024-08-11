import fs from 'node:fs/promises';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { text as toText } from 'node:stream/consumers';

import { Suite, Test, TestFixtures } from '@travetto/test';

import { BaseModelSuite } from './base';
import { ModelStreamSupport } from '../../src/service/stream';
import { enforceRange } from '../../src/internal/service/stream';

@Suite()
export abstract class ModelStreamSuite extends BaseModelSuite<ModelStreamSupport> {

  fixture = new TestFixtures(['@travetto/model']);

  async getHash(stream: Readable): Promise<string> {
    const hash = crypto.createHash('sha1').setEncoding('hex');
    await pipeline(stream, hash);
    return hash.read().toString();
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
    const content = await toText(retrieved);
    assert(content.startsWith('abc'));
    assert(content.endsWith('xyz'));

    const partial = await service.getStream(meta.hash, { start: 10, end: 20 });
    const subContent = await toText(partial);
    const range = await enforceRange({ start: 10, end: 20 }, meta.size);
    assert(subContent.length === (range.end - range.start) + 1);

    const og = await this.fixture.read('/text.txt');

    assert(subContent === og.substring(10, 21));

    const partialUnbounded = await service.getStream(meta.hash, { start: 10 });
    const subContent2 = await toText(partialUnbounded);
    const range2 = await enforceRange({ start: 10 }, meta.size);
    assert(subContent2.length === (range2.end - range2.start) + 1);
    assert(subContent2.startsWith('klm'));
    assert(subContent2.endsWith('xyz'));

    const partialSingle = await service.getStream(meta.hash, { start: 10, end: 10 });
    const subContent3 = await toText(partialSingle);
    assert(subContent3.length === 1);
    assert(subContent3 === 'k');

    const partialOverBounded = await service.getStream(meta.hash, { start: 20, end: 40 });
    const subContent4 = await toText(partialOverBounded);
    assert(subContent4.length === 6);
    assert(subContent4.endsWith('xyz'));

    await assert.rejects(() => service.getStream(meta.hash, { start: -10, end: 10 }));
    await assert.rejects(() => service.getStream(meta.hash, { start: 30, end: 37 }));
  }
}