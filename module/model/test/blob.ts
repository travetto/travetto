import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { BlobMeta } from '@travetto/runtime';
import { ModelBlobUtil } from '../__index__';

@Suite()
class BlobUtilSuite {
  @Test()
  async simpleTest() {
    const meta: BlobMeta = {
      hash: 'ora_nge_bee_for_sly_',
      filename: 'bob'
    };

    assert(ModelBlobUtil.getHashedLocation(meta) === 'ora_/nge_/bee_/for_/sly_.bin');

    meta.filename = 'billy.jpeg';

    assert(ModelBlobUtil.getHashedLocation(meta) === 'ora_/nge_/bee_/for_/sly_.jpeg');

    meta.filename = 'video.mp4';

    assert(ModelBlobUtil.getHashedLocation(meta) === 'ora_/nge_/bee_/for_/sly_.mp4');

    meta.filename = 'none';

    assert(ModelBlobUtil.getHashedLocation(meta) === 'ora_/nge_/bee_/for_/sly_.bin');
  }

  @Test()
  async simpleShort() {
    const meta: BlobMeta = {
      hash: 'ora_nge_bee'
    };

    assert(ModelBlobUtil.getHashedLocation(meta) === 'ora_/nge_/bee.bin');

    meta.contentType = 'image/jpeg';
    meta.filename = 'image.jpeg';

    assert(ModelBlobUtil.getHashedLocation(meta) === 'ora_/nge_/bee.jpeg');

  }
}