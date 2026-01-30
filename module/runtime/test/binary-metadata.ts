import crypto from 'node:crypto';
import assert from 'node:assert';
import { buffer } from 'node:stream/consumers';
import { Readable } from 'node:stream';

import { Test, Suite, TestFixtures } from '@travetto/test';
import { BinaryMetadataUtil, BinaryUtil } from '@travetto/runtime';

@Suite()
export class BinaryMetadataUtilSuite {

  fixture = new TestFixtures();

  @Test()
  async verifyReadableBlob() {
    const stream = () => this.fixture.readStream('/logo.png');
    const blob = BinaryMetadataUtil.makeBlob(stream, await BinaryMetadataUtil.compute(await stream()));
    const blobBytes = await buffer(blob.stream());
    const allBytes = await this.fixture.read('/logo.png', true);
    assert(blob.size > 0);
    assert(blob.size === blobBytes.length);
    assert(blobBytes.byteLength === allBytes.byteLength);
    assert(Buffer.isBuffer(blobBytes));
    assert(Buffer.isBuffer(allBytes));
    assert(blobBytes.equals(allBytes));
  }

  @Test()
  async verifyReadableBlobMultiple() {
    const stream = () => this.fixture.readStream('/logo.png');
    const blob = BinaryMetadataUtil.makeBlob(stream, await BinaryMetadataUtil.compute(await stream()));
    await BinaryMetadataUtil.compute(blob);
    const blobBytes = await buffer(blob.stream());
    const allBytes = await buffer(blob.stream());
    assert(blob.size === blobBytes.length);
    assert(blobBytes.byteLength === allBytes.byteLength);
    assert(BinaryUtil.isBinaryArray(blobBytes));
  }

  @Test()
  async verifySimpleHash() {
    const hash = crypto.createHash('sha512');
    hash.update('roger');
    const key = hash.digest('hex');

    assert(BinaryMetadataUtil.hash('roger', { length: 64 }) === key.substring(0, 64));

    const hash2 = crypto.createHash('sha512');
    hash2.update('');
    const unKey = hash2.digest('hex');

    assert(BinaryMetadataUtil.hash('', { length: 20 }) === unKey.substring(0, 20));

    assert(BinaryMetadataUtil.hash('', { length: 20 }) !== key.substring(0, 20));
  }


  @Test()
  async verifyAsyncHash() {
    const text = 'hello world';
    const stream = Readable.from([text]);
    const hash = await BinaryMetadataUtil.hash(stream, { length: 32 });
    const expected = crypto.createHash('sha512').update(text).digest('hex').substring(0, 32);
    assert.strictEqual(hash, expected);
  }

  @Test()
  async verifyHashAlgorithms() {
    const text = 'test value';

    const sha1 = BinaryMetadataUtil.hash(text, { hashAlgorithm: 'sha1' });
    assert.strictEqual(sha1.length, 40); // 20 bytes * 2 hex

    const md5 = BinaryMetadataUtil.hash(text, { hashAlgorithm: 'md5' });
    assert.strictEqual(md5.length, 32); // 16 bytes * 2 hex
  }

  @Test()
  async verifyHashBinaryInput() {
    const input = Buffer.from('binary data');
    const hash = BinaryMetadataUtil.hash(input, { length: 10 });
    assert.strictEqual(hash.length, 10);
  }
}