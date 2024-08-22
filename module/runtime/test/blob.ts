import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';

import { Test, Suite, TestFixtures } from '@travetto/test';
import { BlobUtil } from '../__index__';


@Suite()
export class BlobUtilTest {

  fixtures = new TestFixtures();

  @Test()
  async verifyFileBlob() {
    const blob = await BlobUtil.fileBlob(await this.fixtures.resolve('/logo.png'));
    const blobBytes = Buffer.from(await blob.bytes());
    const allBytes = await this.fixtures.read('/logo.png', true);
    assert(blob.size === blobBytes.length);
    assert(blobBytes.length === allBytes.length);
    assert(blobBytes.equals(allBytes));
  }

  @Test()
  async verifyMemoryBlob() {
    const blob = await BlobUtil.memoryBlob(await this.fixtures.readStream('/logo.png'));
    const blobBytes = Buffer.from(await blob.arrayBuffer());
    const allBytes = await this.fixtures.read('/logo.png', true);
    assert(blob.size === blobBytes.length);
    assert(blobBytes.length === allBytes.length);
    assert(blobBytes.equals(allBytes));
  }

  @Test()
  async verifyStreamBlob() {
    const blob = await BlobUtil.streamBlob(await this.fixtures.readStream('/logo.png'));
    const blobBytes = await buffer(Readable.fromWeb(await blob.stream()));
    const allBytes = await this.fixtures.read('/logo.png', true);
    assert(blob.size === undefined);
    assert(blobBytes.length === allBytes.length);
    assert(blobBytes.equals(allBytes));
  }

  @Test()
  async verifyLazyStreamBlob() {
    const blob = await BlobUtil.lazyStreamBlob(() => this.fixtures.readStream('/logo.png'), {});
    const blobBytes = await buffer(Readable.fromWeb(await blob.stream()));
    const allBytes = await this.fixtures.read('/logo.png', true);
    assert(blob.size === undefined);
    assert(blobBytes.length === allBytes.length);
    assert(blobBytes.equals(allBytes));
  }
}


