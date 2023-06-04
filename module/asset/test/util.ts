import fs from 'fs/promises';
import assert from 'assert';

import { Suite, Test, TestFixtures } from '@travetto/test';

import { AssetUtil } from '../src/util';
import { path } from '@travetto/manifest';

@Suite()
export class UtilTest {

  fixture = new TestFixtures(['@travetto/asset#support/fixtures']);

  @Test()
  async hashFile() {
  }

  @Test()
  async readChunk() {
    const { path: yml } = await this.fixture.describe('/asset.yml');
    const chunk = await AssetUtil.readChunk(yml, 10);
    assert(chunk.length === 10);
  }

  @Test()
  async detectFileType() {
    const { path: png } = await this.fixture.describe('/logo.png');
    const fileType = (await AssetUtil.detectFileType(png))!;
    assert(fileType.ext === 'png');
    assert(fileType.mime === 'image/png');
  }

  @Test()
  async resolveFileType() {
    const { path: file } = await this.fixture.describe('/empty');
    const result = await AssetUtil.resolveFileType(file);
    assert(result === 'application/octet-stream');

    const { path: file2 } = await this.fixture.describe('/empty.m4a');
    const result2 = await AssetUtil.resolveFileType(file2);
    assert(result2 === 'audio/mp4');
  }

  @Test()
  async resolveFileTypeByExt() {
    const { path: file } = await this.fixture.describe('/logo.png');
    await fs.copyFile(file, file.replace(/[.]png$/, ''));
    const { path: png } = await this.fixture.describe('/logo');
    const result = await AssetUtil.resolveFileType(png);
    assert(result === 'image/png');
  }

  @Test()
  async fileToAsset() {
    const { path: file } = await this.fixture.describe('/logo.png');
    await fs.copyFile(file, file.replace(/[.]png$/, ''));

    const { path: png } = await this.fixture.describe('/logo');
    const asset = await AssetUtil.fileToAsset(png);
    assert(path.basename(file) === 'logo.png');
    assert(asset.contentType === 'image/png');
    assert(asset.filename === 'logo.png');
    assert(asset.size === (await fs.stat(png)).size);
  }
}