import assert from 'node:assert';

import { Suite, Test, TestFixtures } from '@travetto/test';
import { BinaryMetadataUtil, BinaryUtil, Util } from '@travetto/runtime';

import { BaseModelSuite } from '@travetto/model/support/test/base.ts';

import type { ModelBlobSupport } from '../../src/types/blob.ts';

@Suite()
export abstract class ModelBlobSuite extends BaseModelSuite<ModelBlobSupport> {

  fixture = new TestFixtures(['@travetto/model']);

  @Test()
  async writeBasic(): Promise<void> {
    const service = await this.service;
    const buffer = await this.fixture.readBinaryArray('/asset.yml');

    const id = Util.uuid();

    await service.upsertBlob(id, buffer);
    const m = await service.getBlobMetadata(id);
    const retrieved = await service.getBlobMetadata(id);
    assert.deepStrictEqual(m, retrieved);
  }

  @Test()
  async upsert(): Promise<void> {
    const service = await this.service;
    const buffer = await this.fixture.readBinaryArray('/asset.yml');

    const id = Util.uuid();

    await service.upsertBlob(id, buffer, { hash: '10' });
    assert((await service.getBlobMetadata(id)).hash === '10');

    await service.upsertBlob(id, buffer, { hash: '20' });
    assert((await service.getBlobMetadata(id)).hash === '20');

    await service.upsertBlob(id, buffer, { hash: '30' }, false);
    assert((await service.getBlobMetadata(id)).hash === '20');
  }

  @Test()
  async writeStream(): Promise<void> {
    const service = await this.service;
    const buffer = await this.fixture.readBinaryArray('/asset.yml');

    const id = Util.uuid();
    await service.upsertBlob(id, buffer);
    const { hash } = await service.getBlobMetadata(id);

    const retrieved = await service.getBlob(id);
    const { hash: received } = BinaryMetadataUtil.read(retrieved)!;
    assert(hash === received);
  }

  @Test()
  async writeAndDelete(): Promise<void> {
    const service = await this.service;
    const buffer = await this.fixture.readBinaryArray('/asset.yml');

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
    const buffer = await this.fixture.readBinaryArray('/text.txt');

    const id = Util.uuid();
    await service.upsertBlob(id, buffer);

    const retrieved = await service.getBlob(id);
    const content = await retrieved.text();
    assert(content.startsWith('abc'));
    assert(content.endsWith('xyz'));

    const partial = await service.getBlob(id, { start: 10, end: 20 });
    assert(partial.size === 11);
    const partialMeta = BinaryMetadataUtil.read(partial)!;
    const subContent = await partial.text();
    const range = await BinaryMetadataUtil.enforceRange({ start: 10, end: 20 }, partialMeta);
    assert(subContent.length === (range.end - range.start) + 1);

    const og = await this.fixture.readText('/text.txt');

    assert(subContent === og.substring(10, 21));

    const partialUnbounded = await service.getBlob(id, { start: 10 });
    const partialUnboundedMeta = BinaryMetadataUtil.read(partialUnbounded)!;
    const subContent2 = await partialUnbounded.text();
    const range2 = await BinaryMetadataUtil.enforceRange({ start: 10 }, partialUnboundedMeta);
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
    const buffer = await this.fixture.readBinaryArray('/asset.yml');
    await service.upsertBlob('orange', buffer, { contentType: 'text/yaml', filename: 'asset.yml' });
    const saved = await service.getBlob('orange');
    const savedMeta = BinaryMetadataUtil.read(saved)!;
    console.error(savedMeta);

    assert('text/yaml' === savedMeta.contentType);
    assert(buffer.byteLength === savedMeta.size);
    assert('asset.yml' === savedMeta.filename);
    assert(!!savedMeta.hash);
  }

  @Test()
  async metadataUpdate() {
    const service = await this.service;

    await this.writeAndGet();

    await service.updateBlobMetadata('orange', {
      contentType: 'text/yml',
      filename: 'orange.yml'
    });

    const savedMeta = await service.getBlobMetadata('orange');

    assert('text/yml' === savedMeta.contentType);
    assert('orange.yml' === savedMeta.filename);
    assert(savedMeta.hash === undefined);
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  @Test({ skip: (x: unknown) => !(x as ModelBlobSuite).serviceClass.prototype.getBlobWriteUrl })
  async signedUrl() {
    const service = await this.service;

    const bytes = BinaryUtil.binaryArrayToBuffer(BinaryUtil.makeBinaryArray(1.5 * 10000));
    for (let i = 0; i < bytes.byteLength; i++) {
      bytes.writeUInt8(Math.trunc(Math.random() * 255), i);
    }

    const writable = await service.getBlobWriteUrl!('largeFile/one', {
      contentType: 'image/jpeg',
    });

    assert(writable);

    const response = await fetch(writable, {
      method: 'PUT',
      body: new File([bytes], 'gary', { type: 'image/jpeg' }),
    });

    console.error(await response.text());

    assert(response.ok);

    await service.updateBlobMetadata('largeFile/one', {
      contentType: 'image/jpeg',
      title: 'orange',
      filename: 'gary',
      size: bytes.byteLength,
    });

    const found = await service.getBlob('largeFile/one');
    const foundMeta = BinaryMetadataUtil.read(found);
    assert(found.size === bytes.byteLength);
    assert(found.type === 'image/jpeg');
    assert(foundMeta.title === 'orange');
    assert(foundMeta.filename === 'gary');
  }
}