import assert from 'node:assert';
import { buffer } from 'node:stream/consumers';

import { Test, Suite, TestFixtures } from '@travetto/test';
import { BinaryBlob, BinaryUtil } from '@travetto/runtime';

@Suite()
export class BlobUtilSuite {

  fixture = new TestFixtures();

  @Test()
  async verifyReadableBlob() {
    const stream = () => this.fixture.readStream('/logo.png');
    const blob = new BinaryBlob(stream).updateMetadata(await BinaryUtil.computeMetadata(await stream()));
    const blobBytes = await buffer(blob.stream());
    const allBytes = await this.fixture.read('/logo.png', true);
    assert(blob.size === blobBytes.length);
    assert(blobBytes.byteLength === allBytes.byteLength);
    assert(Buffer.isBuffer(blobBytes));
    assert(Buffer.isBuffer(allBytes));
    assert(blobBytes.equals(allBytes));
  }

  @Test()
  async verifyReadableBlobMultiple() {
    const stream = () => this.fixture.readStream('/logo.png');
    const blob = new BinaryBlob(stream).updateMetadata(await BinaryUtil.computeMetadata(await stream()));
    await BinaryUtil.computeMetadata(blob);
    const blobBytes = await buffer(blob.stream());
    const allBytes = await buffer(blob.stream());
    assert(blob.size === blobBytes.length);
    assert(blobBytes.byteLength === allBytes.byteLength);
    assert(BinaryUtil.isBinaryArray(blobBytes));
  }
}