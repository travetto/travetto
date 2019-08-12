import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { ResourceManager, SystemUtil } from '@travetto/base';
import { ImageUtil } from '../src/util';

@Suite('ImageUtils')
class ImageUtilTest {

  @Test('resize test')
  async resizeImage() {

    const imgBuffer = await ResourceManager.read('/apple.jpg');

    assert(imgBuffer.length > 0);

    const resizedBuffer = await ImageUtil.resize(imgBuffer, { h: 100, w: 100 });

    assert(resizedBuffer.length > 0);

    assert(imgBuffer.length > resizedBuffer.length);
  }

  @Test('compress png')
  async compressPng() {
    const imgStream = await ResourceManager.readToStream('/google.png');
    const imgBuffer = await ResourceManager.read('/google.png');

    const out = await ImageUtil.optimizePng(imgStream);

    const optimized = await SystemUtil.toBuffer(out);

    assert(optimized.length > 0);

    assert(imgBuffer.length >= optimized.length);
  }
}