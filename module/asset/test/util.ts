import * as fs from 'fs';
import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';
import { ResourceManager } from '@travetto/base';
import { AssetUtil } from '../src/util';

@Suite()
export class UtilTest {

  @Test()
  async hashFile() {
  }

  @Test()
  async readChunk() {
    const yml = await ResourceManager.toAbsolutePath('asset.yml');
    const chunk = await AssetUtil.readChunk(yml, 10);
    assert(chunk.length === 10);
  }

  @Test()
  async detectFileType() {
    const png = await ResourceManager.toAbsolutePath('google.png');
    const fileType = (await AssetUtil.detectFileType(png))!;
    assert(fileType.ext === 'png');
    assert(fileType.mime === 'image/png');
  }

  @Test()
  async resolveFileType() {
    const png = await ResourceManager.toAbsolutePath('google');
    const result = await AssetUtil.resolveFileType(png);
    assert(result === 'image/png');
  }

  @Test()
  async fileToAsset() {
    const png = await ResourceManager.toAbsolutePath('google');
    const asset = await AssetUtil.fileToAsset(png);
    assert(asset.contentType === 'image/png');
    assert(asset.filename === png);
    assert(asset.size === fs.statSync(png).size);
  }
}