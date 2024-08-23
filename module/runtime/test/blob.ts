import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';

import { Test, Suite, TestFixtures } from '@travetto/test';
import { BlobUtil } from '../__index__';


@Suite()
export class BlobUtilTest {

  fixtures = new TestFixtures();

  @Test()
  async verifyReadableBlob() {
    const blob = await BlobUtil.readableBlob(() => this.fixtures.readStream('/logo.png'), {});
    const blobBytes = await buffer(Readable.fromWeb(await blob.stream()));
    const allBytes = await this.fixtures.read('/logo.png', true);
    assert(blob.size === undefined);
    assert(blobBytes.length === allBytes.length);
    assert(blobBytes.equals(allBytes));
  }
}


