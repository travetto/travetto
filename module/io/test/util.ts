import assert from 'node:assert';
import fs from 'node:fs/promises';

import { Test, Suite, TestFixtures } from '@travetto/test';

import { IOUtil } from '../src/util';

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


  @Test()
  async detectFileType() {
    const png = await this.fixture.resolve('/logo.png');
    const fileType = await IOUtil.detectType(png);
    assert(fileType.ext === 'png');
    assert(fileType.mime === 'image/png');

    const gifStream = await this.fixture.readStream('/logo.gif');
    const fileType2 = await IOUtil.detectType(gifStream);
    assert(fileType2.ext === 'gif');
    assert(fileType2.mime === 'image/gif');

    const unnamed = await this.fixture.read('/logo', true);
    const fileType3 = await IOUtil.detectType(unnamed);
    assert(fileType3.ext === 'png');
    assert(fileType3.mime === 'image/png');

    const mp3Buff = await this.fixture.read('/small-audio.mp3', true);
    const fileType4 = await IOUtil.detectType(mp3Buff);
    assert(fileType4.ext === 'mp3');
    assert(fileType4.mime === 'audio/mpeg');

    const mp3UnnamedBuff = await this.fixture.read('/small-audio', true);
    const fileType5 = await IOUtil.detectType(mp3UnnamedBuff);
    assert(fileType5.ext === 'mp3');
    assert(fileType5.mime === 'audio/mpeg');
  }

  @Test()
  async resolveFileType() {
    const file = await this.fixture.resolve('/empty');
    const result = await IOUtil.detectType(file);
    assert(result.mime === 'application/octet-stream');

    const file2 = await this.fixture.resolve('/empty.m4a');
    const result2 = await IOUtil.detectType(file2);
    assert(result2.mime === 'audio/mp4');

    const file3 = await this.fixture.resolve('/small-audio.mp3');
    const result3 = await IOUtil.detectType(file3);
    assert(result3.mime === 'audio/mpeg');

    const file4 = await this.fixture.resolve('/small-audio');
    const result4 = await IOUtil.detectType(file4);
    assert(result4.mime === 'audio/mpeg');
  }

  @Test()
  async resolveFileTypeByExt() {
    const file = await this.fixture.resolve('/logo.png');
    await fs.copyFile(file, file.replace(/[.]png$/, ''));
    const png = await this.fixture.resolve('/logo');
    const result = await IOUtil.detectType(png);
    assert(result.mime === 'image/png');
  }

  @Test({ shouldThrow: 'size' })
  async testMaxBlobWrite() {
    await IOUtil.writeTempFile(Buffer.alloc(100, 'A', 'utf8'), 'test', 1);
  }

  @Test({ shouldThrow: 'size' })
  async testMaxCloseBlobWrite() {
    await IOUtil.writeTempFile(Buffer.alloc(100, 'A', 'utf8'), 'test', 99);
  }

  @Test()
  async testMaxExactBlobWrite() {
    await IOUtil.writeTempFile(Buffer.alloc(100, 'A', 'utf8'), 'test', 100);
  }
}
