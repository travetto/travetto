import * as fs from 'fs';
import * as assert from 'assert';

import { FsUtil } from '@travetto/boot/src';
import { BeforeAll, Suite, Test } from '@travetto/test';
import { ResourceManager } from '@travetto/base';
import { AssetUtil } from '../src/util';

@Suite()
export class UtilTest {

  @BeforeAll()
  async init() {
    ResourceManager.addPath(FsUtil.resolveUnix(__dirname, '..', 'test-support'));
  }

  @Test()
  async hashFile() {
  }

  @Test()
  async readChunk() {
    const yml = await ResourceManager.findAbsolute('asset.yml');
    const chunk = await AssetUtil.readChunk(yml, 10);
    assert(chunk.length === 10);
  }

  @Test()
  async detectFileType() {
    const png = await ResourceManager.findAbsolute('logo.png');
    const fileType = (await AssetUtil.detectFileType(png))!;
    assert(fileType.ext === 'png');
    assert(fileType.mime === 'image/png');
  }

  @Test()
  async resolveFileType() {
    const file = await ResourceManager.findAbsolute('logo.png');
    await fs.promises.copyFile(file, file.replace(/[.]png$/, ''));
    const png = await ResourceManager.findAbsolute('logo');
    const result = await AssetUtil.resolveFileType(png);
    assert(result === 'image/png');
  }

  @Test()
  async fileToAsset() {
    const file = await ResourceManager.findAbsolute('logo.png');
    await fs.promises.copyFile(file, file.replace(/[.]png$/, ''));

    const png = await ResourceManager.findAbsolute('logo');
    const asset = await AssetUtil.fileToAsset(png);
    assert(asset.contentType === 'image/png');
    assert(asset.filename === png);
    assert(asset.size === fs.statSync(png).size);
  }
}