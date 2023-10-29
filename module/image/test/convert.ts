import os from 'os';
import assert from 'assert';
import fs from 'fs/promises';

import { Test, Suite, TestFixtures } from '@travetto/test';
import { StreamUtil } from '@travetto/base';
import { path } from '@travetto/manifest';

import { ImageConverter } from '../src/convert';

@Suite('ImageConverter')
class ImageConverterTest {

  fixture = new TestFixtures();

  @Test('resize test')
  async resizeImage() {

    const imgBuffer = await this.fixture.read('apple.jpg', true);

    assert(imgBuffer.length > 0);

    const resizedBuffer = await ImageConverter.resize(imgBuffer, { h: 100, w: 100 });

    assert(resizedBuffer.length > 0);

    assert(imgBuffer.length > resizedBuffer.length);
  }

  @Test('compress png')
  async compressPng() {
    const imgStream = await this.fixture.readStream('google.png');
    const imgBuffer = await this.fixture.read('google.png', true);

    const out = await ImageConverter.optimize('png', imgStream);

    const optimized = await StreamUtil.toBuffer(out);

    assert(optimized.length > 0);

    assert(imgBuffer.length >= optimized.length);
  }

  @Test('compress jpeg')
  async compressJpeg() {
    const imgStream = await this.fixture.readStream('lincoln.jpg');
    const imgBuffer = await this.fixture.read('lincoln.jpg', true);

    const out = await ImageConverter.optimize('jpeg', imgStream);

    const optimized = await StreamUtil.toBuffer(out);

    assert(optimized.length > 0);

    assert(imgBuffer.length >= optimized.length);
  }

  @Test('resizeToFile')
  async resizeToFile() {
    const imgStream = await this.fixture.readStream('lincoln.jpg');
    const out = await ImageConverter.resize(imgStream, {
      w: 50,
      h: 50,
      optimize: true
    });

    const outFile = path.resolve(os.tmpdir(), `temp.${Date.now()}.${Math.random()}.png`);
    await StreamUtil.writeToFile(out, outFile);
    assert.ok(await fs.stat(outFile).then(() => true, () => false));

    const dims = await ImageConverter.getDimensions(outFile);
    assert(dims.height === 50);
    assert(dims.width === 50);

    await fs.unlink(outFile);
    assert(await fs.stat(outFile).then(() => false, () => true));
  }

  @Test()
  async resizeLooseToFile() {
    const imgStream = await this.fixture.readStream('lincoln.jpg');
    const out = await ImageConverter.resize(imgStream, {
      w: 50,
      h: 50,
      strictResolution: false,
      optimize: true
    });

    const outFile = path.resolve(os.tmpdir(), `temp.${Date.now()}.${Math.random()}.png`);
    await StreamUtil.writeToFile(out, outFile);
    assert.ok(await fs.stat(outFile).then(() => true, () => false));

    const dims = await ImageConverter.getDimensions(outFile);
    assert(dims.height === 50);
    assert(dims.width === 37);

    await fs.unlink(outFile);
    assert(await fs.stat(outFile).then(() => false, () => true));
  }
}