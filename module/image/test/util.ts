import os from 'node:os';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { buffer as toBuffer } from 'node:stream/consumers';
import { createWriteStream } from 'node:fs';
import path from 'node:path';

import { Test, Suite, TestFixtures } from '@travetto/test';

import { ImageUtil } from '../src/util';

@Suite()
class ImageUtilSuite {

  fixture = new TestFixtures();

  @Test('resize test')
  async resizeImage() {
    const imgBuffer = await this.fixture.read('apple.jpg', true);

    assert(imgBuffer.length > 0);

    const resizedBuffer = await ImageUtil.resize(imgBuffer, { h: 100, w: 100 });

    assert(resizedBuffer.length > 0);

    assert(imgBuffer.length > resizedBuffer.length);
  }

  @Test('compress png')
  async compressPng() {
    const imgStream = await this.fixture.readStream('google.png');
    const imgBuffer = await this.fixture.read('google.png', true);

    const out = await ImageUtil.optimize(imgStream);

    const optimized = await toBuffer(out);

    assert(optimized.length > 0);

    assert(imgBuffer.length >= optimized.length);
  }

  @Test('compress jpeg')
  async compressJpeg() {
    const imgStream = await this.fixture.readStream('lincoln.jpg');
    const imgBuffer = await this.fixture.read('lincoln.jpg', true);

    const out = await ImageUtil.optimize(imgStream, { format: 'jpeg', asSubprocess: true });

    const optimized = await toBuffer(out);

    assert(optimized.length > 0);

    assert(imgBuffer.length >= optimized.length);
  }

  @Test('resizeToFile')
  async resizeToFile() {
    const imgStream = await this.fixture.readStream('lincoln.jpg');
    const out = await ImageUtil.resize(imgStream, {
      w: 50,
      h: 50,
      optimize: true
    });

    const outFile = path.resolve(os.tmpdir(), `temp.${Date.now()}.${Math.random()}.png`);
    await pipeline(out, createWriteStream(outFile));
    assert.ok(await fs.stat(outFile).then(() => true, () => false));

    const dims = await ImageUtil.getDimensions(outFile);
    assert(dims.height === 50);
    assert(dims.width === 50);

    await fs.unlink(outFile);
    assert(await fs.stat(outFile).then(() => false, () => true));
  }

  @Test()
  async resizeLooseToFile() {
    const imgStream = await this.fixture.readStream('lincoln.jpg');
    const out = await ImageUtil.resize(imgStream, {
      w: 50,
      h: 50,
      strictResolution: false,
      optimize: true,
      asSubprocess: true
    });

    const outFile = path.resolve(os.tmpdir(), `temp.${Date.now()}.${Math.random()}.png`);
    await pipeline(out, createWriteStream(outFile));
    assert.ok(await fs.stat(outFile).then(() => true, () => false));

    const dims = await ImageUtil.getDimensions(outFile);
    assert(dims.height === 50);
    assert(dims.width === 37);

    await fs.unlink(outFile);
    assert(await fs.stat(outFile).then(() => false, () => true));
  }
}