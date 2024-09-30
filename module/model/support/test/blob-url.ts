import assert from 'node:assert';

import { Suite, Test, TestFixtures } from '@travetto/test';
import { BaseModelSuite } from '@travetto/model/support/test/base';
import { BinaryUtil } from '@travetto/runtime';

import { ModelBlobUrlSupport } from '../../__index__';


@Suite()
export abstract class ModelBlobUrlSuite extends BaseModelSuite<ModelBlobUrlSupport> {

  fixture = new TestFixtures(['@travetto/model']);

  @Test()
  async signedUrl() {
    const service = await this.service;


    const buffer = Buffer.alloc(1.5 * 10000);
    for (let i = 0; i < buffer.length; i++) {
      buffer.writeUInt8(Math.trunc(Math.random() * 255), i);
    }

    const writable = await service.getBlobWriteUrl('largeFile/one', {
      contentType: 'image/jpeg',
    });

    console.log(writable);
    assert(writable);

    const res = await fetch(writable, {
      method: 'PUT',
      body: new File([buffer], 'gary', { type: 'image/jpeg' }),
    });

    console.error(await res.text());

    assert(res.ok);

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