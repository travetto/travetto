import fs from 'node:fs/promises';
import assert from 'node:assert';
import path from 'node:path';

import { Suite, Test, TestFixtures } from '@travetto/test';

import { ModelBlobUtil } from '../src/util';
import { IOUtil } from '@travetto/runtime';

@Suite()
export class UtilTest {

  fixture = new TestFixtures();

  @Test()
  async detectFileType() {
    const png = await this.fixture.resolve('/logo.png');
    const fileType = await ModelBlobUtil.detectFileType(png);
    assert(fileType);
    assert(fileType.ext === 'png');
    assert(fileType.mime === 'image/png');

    const gifStream = await this.fixture.readStream('/logo.gif');
    const fileType2 = await ModelBlobUtil.detectFileType(gifStream);
    assert(fileType2);
    assert(fileType2.ext === 'gif');
    assert(fileType2.mime === 'image/gif');

    const unnamed = await this.fixture.read('/logo', true);
    const fileType3 = await ModelBlobUtil.detectFileType(unnamed);
    assert(fileType3!.ext === 'png');
    assert(fileType3!.mime === 'image/png');

    const mp3Buff = await this.fixture.read('/small-audio.mp3', true);
    const fileType4 = await ModelBlobUtil.detectFileType(mp3Buff);
    assert(fileType4!.ext === 'mp3');
    assert(fileType4!.mime === 'audio/mpeg');

    const mp3UnnamedBuff = await this.fixture.read('/small-audio', true);
    const fileType5 = await ModelBlobUtil.detectFileType(mp3UnnamedBuff);
    assert(fileType5!.ext === 'mp3');
    assert(fileType5!.mime === 'audio/mpeg');
  }

  @Test()
  async resolveFileType() {
    const file = await this.fixture.resolve('/empty');
    const result = await ModelBlobUtil.resolveFileType(file);
    assert(result === 'application/octet-stream');

    const file2 = await this.fixture.resolve('/empty.m4a');
    const result2 = await ModelBlobUtil.resolveFileType(file2);
    assert(result2 === 'audio/mp4');

    const file3 = await this.fixture.resolve('/small-audio.mp3');
    const result3 = await ModelBlobUtil.resolveFileType(file3);
    assert(result3 === 'audio/mpeg');

    const file4 = await this.fixture.resolve('/small-audio');
    const result4 = await ModelBlobUtil.resolveFileType(file4);
    assert(result4 === 'audio/mpeg');
  }

  @Test()
  async resolveFileTypeByExt() {
    const file = await this.fixture.resolve('/logo.png');
    await fs.copyFile(file, file.replace(/[.]png$/, ''));
    const png = await this.fixture.resolve('/logo');
    const result = await ModelBlobUtil.resolveFileType(png);
    assert(result === 'image/png');
  }

  @Test()
  async fileToAsset() {
    const file = await this.fixture.resolve('/logo.png');
    await fs.copyFile(file, file.replace(/[.]png$/, ''));

    const png = await this.fixture.resolve('/logo');
    const asset = await ModelBlobUtil.asBlob(png);
    assert(path.basename(file) === 'logo.png');
    assert(asset.meta.contentType === 'image/png');
    assert(asset.meta.filename === 'logo.png');
    assert(asset.size === (await fs.stat(png)).size);
  }


  @Test()
  async verifyHash() {
    const pth = await this.fixture.resolve('/asset.yml');
    const file = await ModelBlobUtil.asBlob(pth);
    const location = ModelBlobUtil.getHashedLocation(file);
    const hash = await IOUtil.hashInput(file);
    assert(location.replace(/\//g, '').replace(/[.][^.]+$/, '') === hash);
  }
}