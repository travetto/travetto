import * as fs from 'fs/promises';
import * as assert from 'assert';

import { BeforeAll, Suite, Test, TestFile } from '@travetto/test';

import { AssetUtil } from '../src/util';

@Suite()
export class UtilTest {

  @BeforeAll()
  async init() {
    TestFile.addPath(`${__source.folder}/../support/resources`);
  }

  @Test()
  async hashFile() {
  }

  @Test()
  async readChunk() {
    const yml = await TestFile.find('asset.yml');
    const chunk = await AssetUtil.readChunk(yml, 10);
    assert(chunk.length === 10);
  }

  @Test()
  async detectFileType() {
    const png = await TestFile.find('logo.png');
    const fileType = (await AssetUtil.detectFileType(png))!;
    assert(fileType.ext === 'png');
    assert(fileType.mime === 'image/png');
  }

  @Test()
  async resolveFileType() {
    const file = await TestFile.find('logo.png');
    await fs.copyFile(file, file.replace(/[.]png$/, ''));
    const png = await TestFile.find('logo');
    const result = await AssetUtil.resolveFileType(png);
    assert(result === 'image/png');
  }

  @Test()
  async fileToAsset() {
    const file = await TestFile.find('logo.png');
    await fs.copyFile(file, file.replace(/[.]png$/, ''));

    const png = await TestFile.find('logo');
    const asset = await AssetUtil.fileToAsset(png);
    assert(asset.contentType === 'image/png');
    assert(asset.filename === png);
    assert(asset.size === (await fs.stat(png)).size);
  }
}