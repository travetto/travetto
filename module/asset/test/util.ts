import * as fs from 'fs/promises';
import * as assert from 'assert';

import { Resources } from '@travetto/base';
import { BeforeAll, Suite, Test, TestFixtures } from '@travetto/test';

import { AssetUtil } from '../src/util';

@Suite()
export class UtilTest {

  @BeforeAll()
  async init() {
    Resources.getProvider(TestFixtures).addModule('@travetto/asset');
  }

  @Test()
  async hashFile() {
  }

  @Test()
  async readChunk() {
    const { path: yml } = await Resources.describe('test:/asset.yml');
    const chunk = await AssetUtil.readChunk(yml, 10);
    assert(chunk.length === 10);
  }

  @Test()
  async detectFileType() {
    const { path: png } = await Resources.describe('test:/logo.png');
    const fileType = (await AssetUtil.detectFileType(png))!;
    assert(fileType.ext === 'png');
    assert(fileType.mime === 'image/png');
  }

  @Test()
  async resolveFileType() {
    const { path: file } = await Resources.describe('test:/logo.png');
    await fs.copyFile(file, file.replace(/[.]png$/, ''));
    const { path: png } = await Resources.describe('test:/logo');
    const result = await AssetUtil.resolveFileType(png);
    assert(result === 'image/png');
  }

  @Test()
  async fileToAsset() {
    const { path: file } = await Resources.describe('test:/logo.png');
    await fs.copyFile(file, file.replace(/[.]png$/, ''));

    const { path: png } = await Resources.describe('test:/logo');
    const asset = await AssetUtil.fileToAsset(png);
    assert(asset.contentType === 'image/png');
    assert(asset.filename === png);
    assert(asset.size === (await fs.stat(png)).size);
  }
}