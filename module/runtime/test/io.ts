import assert from 'node:assert';
import { Test, Suite, TestFixtures } from '@travetto/test';
import { IOUtil } from '../src/io';

@Suite()
export class IOUtilTest {

  fixture = new TestFixtures();

  @Test()
  async readChunk() {
    const yml = await this.fixture.resolve('/asset.yml');
    const chunk = await IOUtil.readChunk(yml, 10);
    assert(chunk.length === 10);
  }

  @Test()
  async hashUrl() {
    const hash2 = await IOUtil.hashUrl('https://travetto.dev/assets/landing/bg.jpg', 100000);
    assert(hash2.length === 64);

    const hash3 = await IOUtil.hashUrl('https://travetto.dev/assets/landing/bg.jpg', 100001);
    assert(hash3.length === 64);

    assert(hash3 !== hash2);

    const hashFull = await IOUtil.hashUrl('https://travetto.dev/assets/landing/bg.jpg');
    assert(hashFull.length === 64);
    assert(hashFull === '4c6ab4f3fcd07005294391de6b7d83bca59397344f5897411ed5316e212e46c7');
  }

  @Test()
  async fetchBytes() {
    const data = await IOUtil.fetchBytes('https://travetto.dev/assets/landing/bg.jpg', 100000);
    assert(data.length === 100000);

    const data2 = await IOUtil.fetchBytes('https://travetto.dev/assets/landing/bg.jpg', 100001);
    assert(data2.length === 100001);

    const full = await IOUtil.fetchBytes('https://travetto.dev/assets/landing/bg.jpg');
    assert(full.length === 215532);
  }
}