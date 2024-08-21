import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { BlobMeta } from '@travetto/io';
import { ModelBlobUtil } from '../__index__';

@Suite()
class BlobUtilSuite {
  @Test()
  async simpleTest() {
    const meta: BlobMeta = {
      hash: 'ora_nge_bee_for_sly_'
    };

    assert(ModelBlobUtil.getHashedLocation(meta) === 'ora_/nge_/bee_/for_/sly_');

    meta.contentType = 'image/jpeg';

    assert(ModelBlobUtil.getHashedLocation(meta) === 'ora_/nge_/bee_/for_/sly_.jpeg');

    meta.contentType = 'video/mp4';

    assert(ModelBlobUtil.getHashedLocation(meta) === 'ora_/nge_/bee_/for_/sly_.mp4');

    meta.contentType = 'application/octet-stream';

    assert(ModelBlobUtil.getHashedLocation(meta) === 'ora_/nge_/bee_/for_/sly_.bin');
  }

  @Test()
  async simpleShort() {
    const meta: BlobMeta = {
      hash: 'ora_nge_bee'
    };

    assert(ModelBlobUtil.getHashedLocation(meta) === 'ora_nge_bee');

    meta.contentType = 'image/jpeg';

    assert(ModelBlobUtil.getHashedLocation(meta) === 'ora_nge_bee.jpeg');

  }
}