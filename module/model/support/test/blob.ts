import assert from 'node:assert';

import { Suite, Test, TestFixtures } from '@travetto/test';
import { BaseModelSuite } from '@travetto/model/support/test/base';
import { Util } from '@travetto/runtime';
import { IOUtil } from '@travetto/io';

import { ModelBlobSupport } from '../../src/service/blob';
import { ModelBlobUtil } from '../../src/util/blob';

@Suite()
export abstract class ModelBlobSuite extends BaseModelSuite<ModelBlobSupport> {

  fixture = new TestFixtures(['@travetto/model']);

  @Test()
  async writeBasic(): Promise<void> {
    const service = await this.service;
    const buffer = await this.fixture.read('/asset.yml', true);

    const id = Util.uuid();

    await service.upsertBlob(id, buffer);
    const meta = await service.describeBlob(id);
    const retrieved = await service.describeBlob(id);
    assert.deepStrictEqual(meta, retrieved);
  }

  @Test()
  async writeStream(): Promise<void> {
    const service = await this.service;
    const buffer = await this.fixture.read('/asset.yml', true);

    const id = Util.uuid();
    await service.upsertBlob(id, buffer);
    const meta = await service.describeBlob(id);

    const retrieved = await service.getBlob(id);
    const retrievedMeta = IOUtil.getBlobMeta(retrieved)!;
    assert(meta.hash === retrievedMeta.hash);
  }

  @Test()
  async writeAndDelete(): Promise<void> {
    const service = await this.service;
    const buffer = await this.fixture.read('/asset.yml', true);

    const id = Util.uuid();
    await service.upsertBlob(id, buffer);

    await service.deleteBlob(id);

    await assert.rejects(async () => {
      await service.getBlob(id);
    });
  }

  @Test()
  async partialStream(): Promise<void> {
    const service = await this.service;
    const buffer = await this.fixture.read('/text.txt', true);

    const id = Util.uuid();
    await service.upsertBlob(id, buffer);

    const retrieved = await service.getBlob(id);
    const content = await retrieved.text();
    assert(content.startsWith('abc'));
    assert(content.endsWith('xyz'));

    const partial = await service.getBlob(id, { start: 10, end: 20 });
    const partialMeta = IOUtil.getBlobMeta(partial)!;
    const subContent = await partial.text();
    const range = await IOUtil.enforceRange({ start: 10, end: 20 }, partialMeta.size!);
    assert(subContent.length === (range.end - range.start) + 1);

    const og = await this.fixture.read('/text.txt');

    assert(subContent === og.substring(10, 21));

    const partialUnbounded = await service.getBlob(id, { start: 10 });
    const partialUnboundedMeta = IOUtil.getBlobMeta(partial)!;
    const subContent2 = await partialUnbounded.text();
    const range2 = await IOUtil.enforceRange({ start: 10 }, partialUnboundedMeta.size!);
    assert(subContent2.length === (range2.end - range2.start) + 1);
    assert(subContent2.startsWith('klm'));
    assert(subContent2.endsWith('xyz'));

    const partialSingle = await service.getBlob(id, { start: 10, end: 10 });
    const subContent3 = await partialSingle.text();
    assert(subContent3.length === 1);
    assert(subContent3 === 'k');

    const partialOverBounded = await service.getBlob(id, { start: 20, end: 40 });
    const subContent4 = await partialOverBounded.text();
    assert(subContent4.length === 6);
    assert(subContent4.endsWith('xyz'));

    await assert.rejects(() => service.getBlob(id, { start: -10, end: 10 }));
    await assert.rejects(() => service.getBlob(id, { start: 30, end: 37 }));
  }


  @Test()
  async writeAndGet() {
    const service = await this.service;
    const buffer = await this.fixture.read('/asset.yml', true);
    await service.upsertBlob('orange', buffer, { contentType: 'text/yaml', filename: 'asset.yml' });
    const saved = await service.getBlob('orange');
    const savedMeta = IOUtil.getBlobMeta(saved)!;

    const blob = await IOUtil.memoryBlob(await this.fixture.resolve('/asset.yml'));
    const blobMeta = IOUtil.getBlobMeta(blob)!;
    assert(blobMeta.contentType === savedMeta.contentType);
    assert(blob.size === savedMeta.size);
    assert(blobMeta.filename === savedMeta.filename);
    assert(blobMeta.hash === savedMeta.hash);
  }
}