import * as assert from 'assert';
import * as fs from 'fs/promises';

import { Test, Suite } from '@travetto/test';
import { StreamUtil } from '@travetto/boot';
import { ResourceManager } from '@travetto/base';

import { ImageConverter } from '../src/convert';

@Suite('ImageConverter')
class ImageConverterTest {

  @Test('resize test')
  async resizeImage() {

    const imgBuffer = await ResourceManager.read('apple.jpg');

    assert(imgBuffer.length > 0);

    const resizedBuffer = await ImageConverter.resize(imgBuffer, { h: 100, w: 100 });

    assert(resizedBuffer.length > 0);

    assert(imgBuffer.length > resizedBuffer.length);
  }

  @Test('compress png')
  async compressPng() {
    const imgStream = await ResourceManager.readStream('google.png');
    const imgBuffer = await ResourceManager.read('google.png');

    const out = await ImageConverter.optimize('png', imgStream);

    const optimized = await StreamUtil.toBuffer(out);

    assert(optimized.length > 0);

    assert(imgBuffer.length >= optimized.length);
  }

  @Test('compress jpeg')
  async compressJpeg() {
    const imgStream = await ResourceManager.readStream('lincoln.jpg');
    const imgBuffer = await ResourceManager.read('lincoln.jpg');

    const out = await ImageConverter.optimize('jpeg', imgStream);

    const optimized = await StreamUtil.toBuffer(out);

    assert(optimized.length > 0);

    assert(imgBuffer.length >= optimized.length);
  }

  @Test('resizeToFile')
  async resizeToFile() {
    const imgStream = await ResourceManager.readStream('lincoln.jpg');
    const out = await ImageConverter.resize(imgStream, {
      w: 50,
      h: 50,
      optimize: true
    });

    await StreamUtil.writeToFile(out, 'temp.jpg');
    await fs.unlink('temp.jpg');
  }
}