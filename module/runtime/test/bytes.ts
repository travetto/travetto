import assert from 'node:assert';

import { Test, Suite, TestFixtures } from '@travetto/test';

import { BytesUtil } from '../src/bytes';

@Suite()
export class BytesUtilTest {

  fixture = new TestFixtures();

  @Test()
  async readChunk() {
    const yml = await this.fixture.resolve('/asset.yml');
    const chunk = await BytesUtil.readChunk(yml, 10);
    assert(chunk.length === 10);
  }

  @Test()
  async hashUrl() {
    const hash2 = await BytesUtil.hashUrl('https://travetto.dev/assets/landing/bg.jpg', 100000);
    assert(hash2.length === 64);

    const hash3 = await BytesUtil.hashUrl('https://travetto.dev/assets/landing/bg.jpg', 100001);
    assert(hash3.length === 64);

    assert(hash3 !== hash2);

    const hashFull = await BytesUtil.hashUrl('https://travetto.dev/assets/landing/bg.jpg');
    assert(hashFull.length === 64);
    assert(hashFull === '4c6ab4f3fcd07005294391de6b7d83bca59397344f5897411ed5316e212e46c7');
  }

  @Test()
  async fetchBytes() {
    const data = await BytesUtil.fetchBytes('https://travetto.dev/assets/landing/bg.jpg', 100000);
    assert(data.length === 100000);

    const data2 = await BytesUtil.fetchBytes('https://travetto.dev/assets/landing/bg.jpg', 100001);
    assert(data2.length === 100001);

    const full = await BytesUtil.fetchBytes('https://travetto.dev/assets/landing/bg.jpg');
    assert(full.length === 215532);
  }
}
