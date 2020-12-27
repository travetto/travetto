import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';

import { StreamUtil, FsUtil } from '@travetto/boot';
import { ResourceManager } from '@travetto/base';
import { ImageUtil } from '../src/util';

@Suite('ImageUtils')
class ImageUtilTest {

  @Test('resize test')
  async resizeImage() {

    const imgBuffer = await ResourceManager.read('apple.jpg');

    assert(imgBuffer.length > 0);

    const resizedBuffer = await ImageUtil.resize(imgBuffer, { h: 100, w: 100 });

    assert(resizedBuffer.length > 0);

    assert(imgBuffer.length > resizedBuffer.length);
  }

  @Test('compress png')
  async compressPng() {
    const imgStream = await ResourceManager.readStream('google.png');
    const imgBuffer = await ResourceManager.read('google.png');

    const out = await ImageUtil.optimize('png', imgStream);

    const optimized = await StreamUtil.toBuffer(out);

    assert(optimized.length > 0);

    assert(imgBuffer.length >= optimized.length);
  }

  @Test('compress jpeg')
  async compressJpeg() {
    const imgStream = await ResourceManager.readStream('lincoln.jpg');
    const imgBuffer = await ResourceManager.read('lincoln.jpg');

    const out = await ImageUtil.optimize('jpeg', imgStream);

    const optimized = await StreamUtil.toBuffer(out);

    assert(optimized.length > 0);

    assert(imgBuffer.length >= optimized.length);
  }

  @Test('resizeToFile')
  async resizeToFile() {
    const imgStream = await ResourceManager.readStream('lincoln.jpg');
    const out = await ImageUtil.resize(imgStream, {
      w: 50,
      h: 50,
      optimize: true
    });

    await StreamUtil.writeToFile(out, 'temp.jpg');
    require('fs').unlinkSync('temp.jpg');
  }
}