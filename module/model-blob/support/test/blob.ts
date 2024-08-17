import assert from 'node:assert';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { text as toText } from 'node:stream/consumers';

import { Suite, Test, TestFixtures } from '@travetto/test';
import { BaseModelSuite } from '@travetto/model/support/test/base';

import { ModelBlobSupport } from '../../src/service';
import { BlobWithMeta } from '../../__index__';

@Suite()
export abstract class ModelBlobSuite extends BaseModelSuite<ModelBlobSupport> {

  fixture = new TestFixtures(['@travetto/model']);

  async getHash(stream: Readable): Promise<string> {
    const hash = crypto.createHash('sha1').setEncoding('hex');
    await pipeline(stream, hash);
    return hash.read().toString();
  }

  async getBlob(resource: string): Promise<BlobWithMeta> {
    const file = await this.fixture.resolve(resource);
    return AssetUtil.fileToBlobWitMeta(file);
  }

  @Test()
  async writeBasic(): Promise<void> {
    const service = await this.service;
    const [meta, stream] = await this.getBlob('/asset.yml');

    await service.upsertBlob(meta.hash, stream, meta);

    const retrieved = await service.describeBlob(meta.hash);
    assert(meta === retrieved);
  }

  @Test()
  async writeStream(): Promise<void> {
    const service = await this.service;
    const [meta, stream] = await this.getBlob('/asset.yml');

    await service.upsertBlob(meta.hash, stream, meta);

    const retrieved = await service.getBlob(meta.hash);
    assert(await this.getHash(retrieved) === meta.hash);
  }

  @Test()
  async writeAndDelete(): Promise<void> {
    const service = await this.service;
    const [meta, stream] = await this.getBlob('/asset.yml');

    await service.upsertBlob(meta.hash, stream, meta);

    await service.deleteBlob(meta.hash);

    await assert.rejects(async () => {
      await service.getBlob(meta.hash);
    });
  }

  @Test()
  async partialStream(): Promise<void> {
    const service = await this.service;
    const [meta, stream] = await this.getBlob('/text.txt');

    await service.upsertBlob(meta.hash, stream, meta);

    const retrieved = await service.getBlob(meta.hash);
    const content = await toText(retrieved);
    assert(content.startsWith('abc'));
    assert(content.endsWith('xyz'));

    const partial = await service.getBlob(meta.hash, { start: 10, end: 20 });
    const subContent = await toText(partial);
    const range = await enforceRange({ start: 10, end: 20 }, meta.size);
    assert(subContent.length === (range.end - range.start) + 1);

    const og = await this.fixture.read('/text.txt');

    assert(subContent === og.substring(10, 21));

    const partialUnbounded = await service.getBlob(meta.hash, { start: 10 });
    const subContent2 = await toText(partialUnbounded);
    const range2 = await enforceRange({ start: 10 }, meta.size);
    assert(subContent2.length === (range2.end - range2.start) + 1);
    assert(subContent2.startsWith('klm'));
    assert(subContent2.endsWith('xyz'));

    const partialSingle = await service.getBlob(meta.hash, { start: 10, end: 10 });
    const subContent3 = await toText(partialSingle);
    assert(subContent3.length === 1);
    assert(subContent3 === 'k');

    const partialOverBounded = await service.getBlob(meta.hash, { start: 20, end: 40 });
    const subContent4 = await toText(partialOverBounded);
    assert(subContent4.length === 6);
    assert(subContent4.endsWith('xyz'));

    await assert.rejects(() => service.getBlob(meta.hash, { start: -10, end: 10 }));
    await assert.rejects(() => service.getBlob(meta.hash, { start: 30, end: 37 }));
  }

  @Test()
  async writeHashed() {
    const service = this.assetService;
    const pth = await this.fixture.resolve('/asset.yml');
    const file = await AssetUtil.fileToBlobWitMeta(pth);
    const outHashed = await service.upsert(file, false, new HashNamingStrategy());
    const hash = await AssetUtil.computeHash(pth);
    assert(outHashed.replace(/\//g, '').replace(/[.][^.]+$/, '') === hash);
  }

  @Test()
  async writeAndGet() {
    const service = this.assetService;
    const pth = await this.fixture.resolve('/asset.yml');
    const file = await AssetUtil.fileToBlobWitMeta(pth);
    const loc = await service.upsert(file);

    const { meta: saved } = await service.get(loc);

    assert(file.meta.contentType === saved.contentType);
    assert(file.size === saved.size);
    assert(file.meta.filename === saved.filename);
    assert(file.meta.hash === saved.hash);
  }
}