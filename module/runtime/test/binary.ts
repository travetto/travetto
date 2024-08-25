import crypto from 'node:crypto';
import assert from 'node:assert';
import { PassThrough, Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { pipeline } from 'node:stream/promises';

import { Test, Suite, TestFixtures } from '@travetto/test';

import { BinaryUtil } from '../src/binary';
import { BlobMeta } from '../src/types';

@Suite()
export class BytesUtilTest {

  fixture = new TestFixtures();

  @Test()
  async verifyReadableBlob() {
    const blob = await BinaryUtil.readableBlob(() => this.fixture.readStream('/logo.png'), {});
    const blobBytes = await buffer(Readable.fromWeb(await blob.stream()));
    const allBytes = await this.fixture.read('/logo.png', true);
    assert(blob.size === undefined);
    assert(blobBytes.length === allBytes.length);
    assert(blobBytes.equals(allBytes));
  }

  @Test()
  async verifyReadableBlobMultiple() {
    const blob = await BinaryUtil.readableBlob(() => this.fixture.readStream('/logo.png'), {});
    const blobBytes = await buffer(Readable.fromWeb(await blob.stream()));
    const allBytes = await buffer(Readable.fromWeb(await blob.stream()));
    assert(blob.size === undefined);
    assert(blobBytes.length === allBytes.length);
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

  @Test({ shouldThrow: 'size' })
  async testMaxBlobWrite() {
    await pipeline(Readable.from(Buffer.alloc(100, 'A', 'utf8')), BinaryUtil.limitWrite(1), new PassThrough());
  }

  @Test({ shouldThrow: 'size' })
  async testMaxCloseBlobWrite() {
    await pipeline(Readable.from(Buffer.alloc(100, 'A', 'utf8')), BinaryUtil.limitWrite(99), new PassThrough());
  }

  @Test()
  async testMaxExactBlobWrite() {
    await pipeline(Readable.from(Buffer.alloc(100, 'A', 'utf8')), BinaryUtil.limitWrite(100), new PassThrough());
  }

  @Test()
  async simpleTest() {
    const meta: BlobMeta = {
      hash: 'ora_nge_bee_for_sly_',
      filename: 'bob'
    };

    assert(BinaryUtil.hashedBlobLocation(meta) === 'ora_/nge_/bee_/for_/sly_.bin');

    meta.filename = 'billy.jpeg';

    assert(BinaryUtil.hashedBlobLocation(meta) === 'ora_/nge_/bee_/for_/sly_.jpeg');

    meta.filename = 'video.mp4';

    assert(BinaryUtil.hashedBlobLocation(meta) === 'ora_/nge_/bee_/for_/sly_.mp4');

    meta.filename = 'none';

    assert(BinaryUtil.hashedBlobLocation(meta) === 'ora_/nge_/bee_/for_/sly_.bin');
  }

  @Test()
  async simpleShort() {
    const meta: BlobMeta = {
      hash: 'ora_nge_bee'
    };

    assert(BinaryUtil.hashedBlobLocation(meta) === 'ora_/nge_/bee.bin');

    meta.contentType = 'image/jpeg';
    meta.filename = 'image.jpeg';

    assert(BinaryUtil.hashedBlobLocation(meta) === 'ora_/nge_/bee.jpeg');

  }
}