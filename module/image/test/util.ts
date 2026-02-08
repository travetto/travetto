import os from 'node:os';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';

import { Test, Suite, TestFixtures } from '@travetto/test';
import { ImageUtil } from '@travetto/image';
import { BinaryUtil } from '@travetto/runtime';

@Suite()
class ImageUtilSuite {

  fixture = new TestFixtures();

  @Test('resize test')
  async resizeImage() {
    const imgBuffer = await this.fixture.readBinaryArray('apple.jpg');

    assert(imgBuffer.byteLength > 0);

    const resizedBuffer = await BinaryUtil.toBinaryArray(await ImageUtil.convert(imgBuffer, { h: 100, w: 100 }));

    assert(resizedBuffer.byteLength > 0);

    assert(imgBuffer.byteLength > resizedBuffer.byteLength);
  }

  @Test('compress png')
  async compressPng() {
    const imgStream = await this.fixture.readBinaryStream('google.png');
    const imgBuffer = await this.fixture.readBinaryArray('google.png');

    const out = await ImageUtil.convert(imgStream, { optimize: true, format: 'png' });

    const optimized = await BinaryUtil.toBinaryArray(out);

    assert(optimized.byteLength > 0);

    assert(imgBuffer.byteLength >= optimized.byteLength);
  }

  @Test('compress jpeg')
  async compressJpeg() {
    const imgStream = await this.fixture.readBinaryStream('lincoln.jpg');
    const imgBuffer = await this.fixture.readBinaryArray('lincoln.jpg');

    const out = await ImageUtil.convert(imgStream, { optimize: true, format: 'avif' });

    const optimized = await BinaryUtil.toBinaryArray(out);

    assert(optimized.byteLength > 0);

    assert(imgBuffer.byteLength >= optimized.byteLength);

    assert((await ImageUtil.getMetadata(optimized)).format === 'avif');
  }

  @Test('compress jpeg')
  async compressJpegNoFormat() {
    const imgStream = await this.fixture.readBinaryStream('lincoln.jpg');
    const imgBuffer = await this.fixture.readBinaryArray('lincoln.jpg');

    const out = await ImageUtil.convert(imgStream, { optimize: true });

    const optimized = await BinaryUtil.toBinaryArray(out);

    assert(optimized.byteLength > 0);

    assert(imgBuffer.byteLength >= optimized.byteLength);

    assert((await ImageUtil.getMetadata(optimized)).format === 'jpeg');
  }

  @Test('resizeToFile')
  async resizeToFile() {
    const imgFile = await this.fixture.resolve('lincoln.jpg');
    const out = await ImageUtil.convert(createReadStream(imgFile), {
      w: 50,
      h: 50,
      optimize: true,
    });

    const outFile = path.resolve(os.tmpdir(), `temp.${Date.now()}.${Math.random()}.png`);
    await pipeline(out, createWriteStream(outFile));
    assert.ok(await fs.stat(outFile).then(() => true, () => false));

    const dims = await ImageUtil.getMetadata(createReadStream(outFile));
    assert(dims.height === 50);
    assert(dims.width === 50);

    await fs.unlink(outFile);
    assert(await fs.stat(outFile).then(() => false, () => true));
  }

  @Test()
  async resizeLooseWidthToFile() {
    const imgStream = await this.fixture.readBinaryStream('lincoln.jpg');
    const out = await ImageUtil.convert(imgStream, {
      w: 100,
    });

    const outFile = path.resolve(os.tmpdir(), `temp.${Date.now()}.${Math.random()}.png`);
    await pipeline(out, createWriteStream(outFile));
    assert.ok(await fs.stat(outFile).then(() => true, () => false));

    const dims = await ImageUtil.getMetadata(createReadStream(outFile));
    assert(dims.width === 100);
    assert(dims.height === 134);

    await fs.unlink(outFile);
    assert(await fs.stat(outFile).then(() => false, () => true));
  }

  @Test()
  async resizeLooseHeightToFile() {
    const imgStream = await this.fixture.readBinaryStream('lincoln.jpg');
    const out = await ImageUtil.convert(imgStream, {
      h: 134.00005,
    });

    const outFile = path.resolve(os.tmpdir(), `temp.${Date.now()}.${Math.random()}.png`);
    await pipeline(out, createWriteStream(outFile));
    assert.ok(await fs.stat(outFile).then(() => true, () => false));

    const dims = await ImageUtil.getMetadata(createReadStream(outFile));
    assert(dims.width === 100);
    assert(dims.height === 134);

    await fs.unlink(outFile);
    assert(await fs.stat(outFile).then(() => false, () => true));
  }

  @Test()
  async resizeAndChangeFormat() {
    const imgStream = await this.fixture.readBinaryStream('lincoln.jpg');
    const out = await ImageUtil.convert(imgStream, {
      w: 200,
      h: 200,
      format: 'avif',
    });

    const outFile = path.resolve(os.tmpdir(), `temp.${Date.now()}.${Math.random()}.avif`);
    await pipeline(out, createWriteStream(outFile));
    assert.ok(await fs.stat(outFile).then(() => true, () => false));

    const meta = await ImageUtil.getMetadata(createReadStream(outFile));
    assert(meta.width === 200);
    assert(meta.height === 200);

    // Verify the format is avif
    assert(meta.format === 'avif');

    await fs.unlink(outFile);
    assert(await fs.stat(outFile).then(() => false, () => true));
  }
}