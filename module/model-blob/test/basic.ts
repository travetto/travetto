import assert from 'node:assert';

import { Suite, Test, TestFixtures } from '@travetto/test';
import { ModelBlob, ModelBlobUtil, HashNamingStrategy, BlobDataUtil } from '../__index__';


@Suite()
export class ModelBlobBasicSuite {

  fixture = new TestFixtures(['@travetto/model']);

  async getBlob(resource: string): Promise<ModelBlob> {
    const file = await this.fixture.resolve(resource);
    return ModelBlobUtil.asBlob(file);
  }

  @Test()
  async verifyHash() {
    const pth = await this.fixture.resolve('/asset.yml');
    const file = await ModelBlobUtil.asBlob(pth);
    const location = new HashNamingStrategy().resolve(file.meta);
    const hash = await BlobDataUtil.computeHash(file);
    assert(location.replace(/\//g, '').replace(/[.][^.]+$/, '') === hash);
  }
}