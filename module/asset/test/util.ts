import fs from 'node:fs/promises';
import assert from 'node:assert';

import { Suite, Test, TestFixtures } from '@travetto/test';
import { path } from '@travetto/manifest';

import { AssetUtil } from '../src/util';

@Suite()
export class UtilTest {

  fixture = new TestFixtures();

  @Test()
  async hashFile() {
  }

  @Test()
  async readChunk() {
    const yml = await this.fixture.resolve('/asset.yml');
    const chunk = await AssetUtil.readChunk(yml, 10);
    assert(chunk.length === 10);
  }

  @Test()
  async detectFileType() {
    const png = await this.fixture.resolve('/logo.png');
    const fileType = await AssetUtil.detectFileType(png);
    assert(fileType);
    assert(fileType.ext === 'png');
    assert(fileType.mime === 'image/png');

    const gifStream = await this.fixture.readStream('/logo.gif');
    const fileType2 = await AssetUtil.detectFileType(gifStream);
    assert(fileType2);
    assert(fileType2.ext === 'gif');
    assert(fileType2.mime === 'image/gif');

    const m4aBuff = await this.fixture.read('/logo', true);
    const fileType3 = await AssetUtil.detectFileType(m4aBuff);
    assert(fileType3!.ext === 'png');
    assert(fileType3!.mime === 'image/png');
  }

  @Test()
  async resolveFileType() {
    const file = await this.fixture.resolve('/empty');
    const result = await AssetUtil.resolveFileType(file);
    assert(result === 'application/octet-stream');

    const file2 = await this.fixture.resolve('/empty.m4a');
    const result2 = await AssetUtil.resolveFileType(file2);
    assert(result2 === 'audio/mp4');
  }

  @Test()
  async resolveFileTypeByExt() {
    const file = await this.fixture.resolve('/logo.png');
    await fs.copyFile(file, file.replace(/[.]png$/, ''));
    const png = await this.fixture.resolve('/logo');
    const result = await AssetUtil.resolveFileType(png);
    assert(result === 'image/png');
  }

  @Test()
  async fileToAsset() {
    const file = await this.fixture.resolve('/logo.png');
    await fs.copyFile(file, file.replace(/[.]png$/, ''));

    const png = await this.fixture.resolve('/logo');
    const asset = await AssetUtil.fileToAsset(png);
    assert(path.basename(file) === 'logo.png');
    assert(asset.contentType === 'image/png');
    assert(asset.filename === 'logo.png');
    assert(asset.size === (await fs.stat(png)).size);
  }
}