import assert from 'node:assert';
import { Readable, PassThrough } from 'node:stream';
import fs from 'node:fs/promises';

import { Test, Suite, TestFixtures } from '@travetto/test';

import { RestUploadUtil } from '../src/util';

@Suite()
export class BytesUtilTest {

  fixture = new TestFixtures();

  @Test()
  async detectFileType() {
    const png = await this.fixture.resolve('/logo.png');
    const fileType = await RestUploadUtil.detectType(png);
    assert(fileType.ext === 'png');
    assert(fileType.mime === 'image/png');

    const gifStream = await this.fixture.readStream('/logo.gif');
    const fileType2 = await RestUploadUtil.detectType(gifStream);
    assert(fileType2.ext === 'gif');
    assert(fileType2.mime === 'image/gif');

    const unnamed = await this.fixture.read('/logo', true);
    const fileType3 = await RestUploadUtil.detectType(unnamed);
    assert(fileType3.ext === 'png');
    assert(fileType3.mime === 'image/png');

    const mp3Buff = await this.fixture.read('/small-audio.mp3', true);
    const fileType4 = await RestUploadUtil.detectType(mp3Buff);
    assert(fileType4.ext === 'mp3');
    assert(fileType4.mime === 'audio/mpeg');

    const mp3UnnamedBuff = await this.fixture.read('/small-audio', true);
    const fileType5 = await RestUploadUtil.detectType(mp3UnnamedBuff);
    assert(fileType5.ext === 'mp3');
    assert(fileType5.mime === 'audio/mpeg');
  }

  @Test()
  async resolveFileType() {
    const file = await this.fixture.resolve('/empty');
    const result = await RestUploadUtil.detectType(file);
    assert(result.mime === 'application/octet-stream');

    const file2 = await this.fixture.resolve('/empty.m4a');
    const result2 = await RestUploadUtil.detectType(file2);
    assert(result2.mime === 'audio/mp4');

    const file3 = await this.fixture.resolve('/small-audio.mp3');
    const result3 = await RestUploadUtil.detectType(file3);
    assert(result3.mime === 'audio/mpeg');

    const file4 = await this.fixture.resolve('/small-audio');
    const result4 = await RestUploadUtil.detectType(file4);
    assert(result4.mime === 'audio/mpeg');
  }

  @Test()
  async resolveFileTypeByExt() {
    const file = await this.fixture.resolve('/logo.png');
    await fs.copyFile(file, file.replace(/[.]png$/, ''));
    const png = await this.fixture.resolve('/logo');
    const result = await RestUploadUtil.detectType(png);
    assert(result.mime === 'image/png');
  }

  @Test({ shouldThrow: 'size' })
  async testMaxBlobWrite() {
    await RestUploadUtil.streamWithLimit(Readable.from(Buffer.alloc(100, 'A', 'utf8')), new PassThrough(), 1);
  }

  @Test({ shouldThrow: 'size' })
  async testMaxCloseBlobWrite() {
    await RestUploadUtil.streamWithLimit(Readable.from(Buffer.alloc(100, 'A', 'utf8')), new PassThrough(), 99);
  }

  @Test()
  async testMaxExactBlobWrite() {
    await RestUploadUtil.streamWithLimit(Readable.from(Buffer.alloc(100, 'A', 'utf8')), new PassThrough(), 100);
  }
}
