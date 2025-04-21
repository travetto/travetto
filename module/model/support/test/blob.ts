import assert from 'node:assert';

import { Suite, Test, TestFixtures } from '@travetto/test';
import { BinaryUtil, Util } from '@travetto/runtime';

import { BaseModelSuite } from '@travetto/model/support/test/base.ts';

import { ModelBlobSupport } from '../../src/types/blob.ts';
import { ModelBlobUtil } from '../../src/util/blob.ts';

const meta = BinaryUtil.getBlobMeta;

@Suite()
export abstract class ModelBlobSuite extends BaseModelSuite<ModelBlobSupport> {

  fixture = new TestFixtures(['@travetto/model']);

  @Test()
  async writeBasic(): Promise<void> {
    const service = await this.service;
    const buffer = await this.fixture.read('/asset.yml', true);

    const id = Util.uuid();

    await service.upsertBlob(id, buffer);
    const m = await service.getBlobMeta(id);
    const retrieved = await service.getBlobMeta(id);
    assert.deepStrictEqual(m, retrieved);
  }

  @Test()
  async upsert(): Promise<void> {
    const service = await this.service;
    const buffer = await this.fixture.read('/asset.yml', true);

    const id = Util.uuid();

    await service.upsertBlob(id, buffer, { hash: '10' });
    assert((await service.getBlobMeta(id)).hash === '10');

    await service.upsertBlob(id, buffer, { hash: '20' });
    assert((await service.getBlobMeta(id)).hash === '20');

    await service.upsertBlob(id, buffer, { hash: '30' }, false);
    assert((await service.getBlobMeta(id)).hash === '20');
  }

  @Test()
  async writeStream(): Promise<void> {
    const service = await this.service;
    const buffer = await this.fixture.read('/asset.yml', true);

    const id = Util.uuid();
    await service.upsertBlob(id, buffer);
    const { hash } = await service.getBlobMeta(id);

    const retrieved = await service.getBlob(id);
    const { hash: received } = meta(retrieved)!;
    assert(hash === received);
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
    assert(partial.size === 11);
    const partialMeta = meta(partial)!;
    const subContent = await partial.text();
    const range = await ModelBlobUtil.enforceRange({ start: 10, end: 20 }, partialMeta.size!);
    assert(subContent.length === (range.end - range.start) + 1);

    const og = await this.fixture.read('/text.txt');

    assert(subContent === og.substring(10, 21));

    const partialUnbounded = await service.getBlob(id, { start: 10 });
    const partialUnboundedMeta = meta(partial)!;
    const subContent2 = await partialUnbounded.text();
    const range2 = await ModelBlobUtil.enforceRange({ start: 10 }, partialUnboundedMeta.size!);
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
    const savedMeta = meta(saved)!;

    assert('text/yaml' === savedMeta.contentType);
    assert(buffer.length === savedMeta.size);
    assert('asset.yml' === savedMeta.filename);
    assert(undefined === savedMeta.hash);
  }

  @Test()
  async metadataUpdate() {
    const service = await this.service;

    await this.writeAndGet();

    await service.updateBlobMeta('orange', {
      contentType: 'text/yml',
      filename: 'orange.yml'
    });

    const savedMeta = await service.getBlobMeta('orange');

    assert('text/yml' === savedMeta.contentType);
    assert('orange.yml' === savedMeta.filename);
    assert(undefined === savedMeta.hash);
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  @Test({ skip: (x: unknown) => !(x as ModelBlobSuite).serviceClass.prototype.getBlobWriteUrl })
  async signedUrl() {
    const service = await this.service;

    const buffer = Buffer.alloc(1.5 * 10000);
    for (let i = 0; i < buffer.length; i++) {
      buffer.writeUInt8(Math.trunc(Math.random() * 255), i);
    }

    const writable = await service.getBlobWriteUrl!('largeFile/one', {
      contentType: 'image/jpeg',
    });

    console.log(writable);
    assert(writable);

    const response = await fetch(writable, {
      method: 'PUT',
      body: new File([buffer], 'gary', { type: 'image/jpeg' }),
    });

    console.error(await response.text());

    assert(response.ok);

    await service.updateBlobMeta('largeFile/one', {
      contentType: 'image/jpeg',
      title: 'orange',
      filename: 'gary',
      size: buffer.length,
    });

    const found = await service.getBlob('largeFile/one');
    assert(found.size === buffer.length);
    assert(found.type === 'image/jpeg');
    assert(BinaryUtil.getBlobMeta(found)?.title === 'orange');
    assert(BinaryUtil.getBlobMeta(found)?.filename === 'gary');
  }
}