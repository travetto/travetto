import assert from 'node:assert';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';

import { Test, Suite, TestFixtures } from '@travetto/test';
import { BinaryUtil } from '@travetto/runtime';

@Suite()
export class BinaryUtilTest {

  fixture = new TestFixtures();

  @Test()
  async verifyReadableBlob() {
    const blob = await BinaryUtil.toBlob(() => this.fixture.readStream('/logo.png'), {});
    const blobBytes = await buffer(Readable.fromWeb(await blob.stream()));
    const allBytes = await this.fixture.read('/logo.png', true);
    assert(blob.size === undefined);
    assert(blobBytes.byteLength === allBytes.byteLength);
    assert(Buffer.isBuffer(blobBytes));
    assert(Buffer.isBuffer(allBytes));
    assert(blobBytes.equals(allBytes));
  }

  @Test()
  async verifyReadableBlobMultiple() {
    const blob = await BinaryUtil.toBlob(() => this.fixture.readStream('/logo.png'), {});
    const blobBytes = await buffer(Readable.fromWeb(await blob.stream()));
    const allBytes = await buffer(Readable.fromWeb(await blob.stream()));
    assert(blob.size === undefined);
    assert(blobBytes.byteLength === allBytes.byteLength);
    assert(BinaryUtil.isBinaryArray(blobBytes));
  }
}