import assert from 'node:assert';
import fs from 'node:fs/promises';
import { PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createReadStream } from 'node:fs';

import { Test, Suite, TestFixtures } from '@travetto/test';
import { WebUploadUtil } from '@travetto/web-upload';
import { BinaryUtil } from '@travetto/runtime';

const makeData = () => [BinaryUtil.makeBinaryArray(100)];

@Suite()
export class BytesUtilTest {

  fixture = new TestFixtures();

  @Test()
  async detectFileType() {
    const png = await this.fixture.resolve('/logo.png');
    const fileType = await WebUploadUtil.getFileType(createReadStream(png));
    assert(fileType.ext === 'png');
    assert(fileType.mime === 'image/png');

    const gifStream = await this.fixture.readBinaryStream('/logo.gif');
    const fileType2 = await WebUploadUtil.getFileType(gifStream);
    assert(fileType2.ext === 'gif');
    assert(fileType2.mime === 'image/gif');

    const unnamed = await this.fixture.readBinaryStream('/logo');
    const fileType3 = await WebUploadUtil.getFileType(unnamed);
    assert(fileType3.ext === 'png');
    assert(fileType3.mime === 'image/png');

    const mp3Buff = await this.fixture.readBinaryStream('/small-audio.mp3');
    const fileType4 = await WebUploadUtil.getFileType(mp3Buff);
    assert(fileType4.ext === 'mp3');
    assert(fileType4.mime === 'audio/mpeg');

    const mp3UnnamedBuff = await this.fixture.readBinaryStream('/small-audio');
    const fileType5 = await WebUploadUtil.getFileType(mp3UnnamedBuff);
    assert(fileType5.ext === 'mp3');
    assert(fileType5.mime === 'audio/mpeg');
  }

  @Test()
  async resolveFileType() {
    const file = await this.fixture.resolve('/empty');
    const result = await WebUploadUtil.getFileType(createReadStream(file));
    assert(result.mime === 'application/octet-stream');

    const file2 = await this.fixture.resolve('/empty.m4a');
    const result2 = await WebUploadUtil.getFileType(createReadStream(file2), file2);
    assert(result2.mime === 'audio/mp4');

    const file3 = await this.fixture.resolve('/small-audio.mp3');
    const result3 = await WebUploadUtil.getFileType(createReadStream(file3));
    assert(result3.mime === 'audio/mpeg');

    const file4 = await this.fixture.resolve('/small-audio');
    const result4 = await WebUploadUtil.getFileType(createReadStream(file4));
    assert(result4.mime === 'audio/mpeg');
  }

  @Test()
  async resolveFileTypeByExt() {
    const file = await this.fixture.resolve('/logo.png');
    await fs.copyFile(file, file.replace(/[.]png$/, ''));
    const png = await this.fixture.resolve('/logo');
    const result = await WebUploadUtil.getFileType(createReadStream(png));
    assert(result.mime === 'image/png');
  }

  @Test({ shouldThrow: 'size' })
  async testMaxBlobWrite() {
    await pipeline(makeData(), WebUploadUtil.limitWrite(1), new PassThrough());
  }

  @Test({ shouldThrow: 'size' })
  async testMaxCloseBlobWrite() {
    await pipeline(makeData(), WebUploadUtil.limitWrite(99), new PassThrough());
  }

  @Test()
  async testMaxExactBlobWrite() {
    await pipeline(makeData(), WebUploadUtil.limitWrite(100), new PassThrough());
  }
}
