import assert from 'node:assert';

import { Suite, Test, TestFixtures } from '@travetto/test';
import { BaseModelSuite } from '@travetto/model/support/test/base';
import { Util } from '@travetto/runtime';

import { ModelBlobSupport } from '../../src/service';
import { BlobWithMeta } from '../../__index__';
import { ModelBlobUtil } from '../../src/util';
import { BlobDataUtil } from '../../src/data';
import { HashNamingStrategy } from '../../src/naming';

@Suite()
export abstract class ModelBlobSuite extends BaseModelSuite<ModelBlobSupport> {

  fixture = new TestFixtures(['@travetto/model']);

  async getBlob(resource: string): Promise<BlobWithMeta> {
    const file = await this.fixture.resolve(resource);
    return ModelBlobUtil.fileToBlobWitMeta(file);
  }

  @Test()
  async writeBasic(): Promise<void> {
    const service = await this.service;
    const blob = await this.getBlob('/asset.yml');

    const id = Util.uuid();

    await service.upsertBlob(blob, id);
    const retrieved = await service.describeBlob(id);
    assert.deepStrictEqual(blob.meta, retrieved);
  }

  @Test()
  async writeStream(): Promise<void> {
    const service = await this.service;
    const blob = await this.getBlob('/asset.yml');

    const id = Util.uuid();
    await service.upsertBlob(blob, id);

    const retrieved = await service.getBlob(id);
    assert(blob.meta.hash === retrieved.meta.hash);
  }

  @Test()
  async writeAndDelete(): Promise<void> {
    const service = await this.service;
    const blob = await this.getBlob('/asset.yml');

    const id = Util.uuid();
    await service.upsertBlob(blob, id);

    await service.deleteBlob(id);

    await assert.rejects(async () => {
      await service.getBlob(id);
    });
  }

  @Test()
  async partialStream(): Promise<void> {
    const service = await this.service;
    const blob = await this.getBlob('/text.txt');

    const id = Util.uuid();
    await service.upsertBlob(blob, id);

    const retrieved = await service.getBlob(id);
    const content = await retrieved.text();
    assert(content.startsWith('abc'));
    assert(content.endsWith('xyz'));

    const partial = await service.getBlob(id, { start: 10, end: 20 });
    const subContent = await partial.text();
    const range = await ModelBlobUtil.enforceRange({ start: 10, end: 20 }, partial.size);
    assert(subContent.length === (range.end - range.start) + 1);

    const og = await this.fixture.read('/text.txt');

    assert(subContent === og.substring(10, 21));

    const partialUnbounded = await service.getBlob(id, { start: 10 });
    const subContent2 = await partialUnbounded.text();
    const range2 = await ModelBlobUtil.enforceRange({ start: 10 }, partialUnbounded.size);
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
  async writeHashed() {
    const service = await this.service;
    const pth = await this.fixture.resolve('/asset.yml');
    const file = await ModelBlobUtil.fileToBlobWitMeta(pth);
    const outHashed = await service.upsertBlob(file, new HashNamingStrategy());
    const hash = await BlobDataUtil.computeHash(pth);
    assert(outHashed.replace(/\//g, '').replace(/[.][^.]+$/, '') === hash);
  }

  @Test()
  async writeAndGet() {
    const service = await this.service;
    const blob = await this.getBlob('/asset.yml');
    const loc = await service.upsertBlob(blob, 'orange');

    const { meta: saved } = await service.getBlob(loc);

    assert(blob.meta.contentType === saved.contentType);
    assert(blob.size === saved.size);
    assert(blob.meta.filename === saved.filename);
    assert(blob.meta.hash === saved.hash);
  }
}