import * as fs from 'fs/promises';
import * as assert from 'assert';

import { BeforeAll, Suite, Test, TestFixtures } from '@travetto/test';

import { AssetUtil } from '../src/util';

@Suite()
export class UtilTest {

  @BeforeAll()
  async init() {
    TestFixtures.addModulePath('@travetto/asset/support/fixtures');
  }

  @Test()
  async hashFile() {
  }

  @Test()
  async readChunk() {
    const yml = await TestFixtures.find('asset.yml');
    const chunk = await AssetUtil.readChunk(yml, 10);
    assert(chunk.length === 10);
  }

  @Test()
  async detectFileType() {
    const png = await TestFixtures.find('logo.png');
    const fileType = (await AssetUtil.detectFileType(png))!;
    assert(fileType.ext === 'png');
    assert(fileType.mime === 'image/png');
  }

  @Test()
  async resolveFileType() {
    const file = await TestFixtures.find('logo.png');
    await fs.copyFile(file, file.replace(/[.]png$/, ''));
    const png = await TestFixtures.find('logo');
    const result = await AssetUtil.resolveFileType(png);
    assert(result === 'image/png');
  }

  @Test()
  async fileToAsset() {
    const file = await TestFixtures.find('logo.png');
    await fs.copyFile(file, file.replace(/[.]png$/, ''));

    const png = await TestFixtures.find('logo');
    const asset = await AssetUtil.fileToAsset(png);
    assert(asset.contentType === 'image/png');
    assert(asset.filename === png);
    assert(asset.size === (await fs.stat(png)).size);
  }
}