import crypto from 'node:crypto';
import assert from 'node:assert';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';

import { Test, Suite, TestFixtures } from '@travetto/test';
import { BinaryUtil } from '@travetto/runtime';

@Suite()
export class BytesUtilTest {

  fixture = new TestFixtures();

  @Test()
  async verifyReadableBlob() {
    const blob = await BinaryUtil.readableBlob(() => this.fixture.readStream('/logo.png'), {});
    const blobBytes = await buffer(Readable.fromWeb(await blob.stream()));
    const allBytes = await this.fixture.read('/logo.png', true);
    assert(blob.size === undefined);
    assert(blobBytes.byteLength === allBytes.byteLength);
    assert(blobBytes instanceof Buffer);
    assert(allBytes instanceof Buffer);
    assert(blobBytes.equals(allBytes));
  }

  @Test()
  async verifyReadableBlobMultiple() {
    const blob = await BinaryUtil.readableBlob(() => this.fixture.readStream('/logo.png'), {});
    const blobBytes = await buffer(Readable.fromWeb(await blob.stream()));
    const allBytes = await buffer(Readable.fromWeb(await blob.stream()));
    assert(blob.size === undefined);
    assert(blobBytes.byteLength === allBytes.byteLength);
    assert(blobBytes.equals(allBytes));
  }

  @Test()
  async verifySimpleHash() {
    const hash = crypto.createHash('sha512');
    hash.update('roger');
    const key = hash.digest('hex');

    assert(BinaryUtil.hash('roger', 64) === key.substring(0, 64));

    const hash2 = crypto.createHash('sha512');
    hash2.update('');
    const unKey = hash2.digest('hex');

    assert(BinaryUtil.hash('', 20) === unKey.substring(0, 20));

    assert(BinaryUtil.hash('', 20) !== key.substring(0, 20));
  }
}