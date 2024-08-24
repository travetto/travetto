import assert from 'node:assert';

import { Suite, Test, TestFixtures } from '@travetto/test';
import { BaseModelSuite } from '@travetto/model/support/test/base';
import { Util } from '@travetto/runtime';

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
    const retrievedMeta = retrieved.meta!;
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
    assert(partial.size === 11);
    const partialMeta = partial.meta!;
    const subContent = await partial.text();
    const range = await ModelBlobUtil.enforceRange({ start: 10, end: 20 }, partialMeta.size!);
    assert(subContent.length === (range.end - range.start) + 1);

    const og = await this.fixture.read('/text.txt');

    assert(subContent === og.substring(10, 21));

    const partialUnbounded = await service.getBlob(id, { start: 10 });
    const partialUnboundedMeta = partial.meta!;
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
    const savedMeta = saved.meta!;

    assert('text/yaml' === savedMeta.contentType);
    assert(buffer.length === savedMeta.size);
    assert('asset.yml' === savedMeta.filename);
    assert(undefined === savedMeta.hash);
  }
}