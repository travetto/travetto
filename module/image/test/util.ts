import assert from 'node:assert';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compose } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { ImageUtil } from '@travetto/image';
import { BinaryUtil } from '@travetto/runtime';
import { Suite, Test, TestFixtures } from '@travetto/test';

@Suite()
class ImageUtilSuite {
  fixture = new TestFixtures();

  @Test('resize test')
  async resizeImage() {
    const imgBuffer = await this.fixture.readBinaryArray('apple.jpg');

    assert(imgBuffer.byteLength > 0);

    const resizedBuffer = await BinaryUtil.toBinaryArray(ImageUtil.convert(imgBuffer, { h: 100, w: 100 }));

    assert(resizedBuffer.byteLength > 0);

    assert(imgBuffer.byteLength > resizedBuffer.byteLength);
  }

  @Test('compress png')
  async compressPng() {
    const imgStream = this.fixture.readBinaryStream('google.png');
    const imgBuffer = await this.fixture.readBinaryArray('google.png');

    const out = ImageUtil.convert(imgStream, { optimize: true, format: 'png' });

    const optimized = await BinaryUtil.toBinaryArray(out);

    assert(optimized.byteLength > 0);

    assert(imgBuffer.byteLength >= optimized.byteLength);
  }

  @Test('compress jpeg via pipe')
  async compressJpeg() {
    const imgStream = compose(this.fixture.readBinaryStream('lincoln.jpg'), ImageUtil.transform({ optimize: true, format: 'avif' }));
    const imgBuffer = await this.fixture.readBinaryArray('lincoln.jpg');

    const optimized = await BinaryUtil.toBinaryArray(imgStream);

    assert(optimized.byteLength > 0);

    assert(imgBuffer.byteLength >= optimized.byteLength);

    assert((await ImageUtil.getMetadata(optimized)).format === 'avif');
  }

  @Test('compress jpeg')
  async compressJpegNoFormat() {
    const imgStream = this.fixture.readBinaryStream('lincoln.jpg');
    const imgBuffer = await this.fixture.readBinaryArray('lincoln.jpg');

    const out = ImageUtil.convert(imgStream, { optimize: true });

    const optimized = await BinaryUtil.toBinaryArray(out);

    assert(optimized.byteLength > 0);

    assert(imgBuffer.byteLength >= optimized.byteLength);

    assert((await ImageUtil.getMetadata(optimized)).format === 'jpeg');
  }

  @Test('resizeToFile')
  async resizeToFile() {
    const imgFile = await this.fixture.resolve('lincoln.jpg');
    const out = ImageUtil.convert(createReadStream(imgFile), {
      w: 50,
      h: 50,
      optimize: true
    });

    const outFile = path.resolve(os.tmpdir(), `temp.${Date.now()}.${Math.random()}.png`);
    await pipeline(out, createWriteStream(outFile));
    assert.ok(
      await fs.stat(outFile).then(
        () => true,
        () => false
      )
    );

    const dims = await ImageUtil.getMetadata(createReadStream(outFile));
    assert(dims.height === 50);
    assert(dims.width === 50);

    await fs.unlink(outFile);
    assert(
      await fs.stat(outFile).then(
        () => false,
        () => true
      )
    );
  }

  @Test()
  async resizeLooseWidthToFile() {
    const outFile = path.resolve(os.tmpdir(), `temp.${Date.now()}.${Math.random()}.png`);
    await pipeline(this.fixture.readBinaryStream('lincoln.jpg'), ImageUtil.transform({ w: 100 }), createWriteStream(outFile));

    assert.ok(
      await fs.stat(outFile).then(
        () => true,
        () => false
      )
    );

    const dims = await ImageUtil.getMetadata(createReadStream(outFile));
    assert(dims.width === 100);
    assert(dims.height === 134);

    await fs.unlink(outFile);
    assert(
      await fs.stat(outFile).then(
        () => false,
        () => true
      )
    );
  }

  @Test()
  async resizeLooseHeightToFile() {
    const imgStream = this.fixture.readBinaryStream('lincoln.jpg');
    const out = ImageUtil.convert(imgStream, {
      h: 134.00005
    });

    const outFile = path.resolve(os.tmpdir(), `temp.${Date.now()}.${Math.random()}.png`);
    await pipeline(out, createWriteStream(outFile));
    assert.ok(
      await fs.stat(outFile).then(
        () => true,
        () => false
      )
    );

    const dims = await ImageUtil.getMetadata(createReadStream(outFile));
    assert(dims.width === 100);
    assert(dims.height === 134);

    await fs.unlink(outFile);
    assert(
      await fs.stat(outFile).then(
        () => false,
        () => true
      )
    );
  }

  @Test()
  async resizeAndChangeFormat() {
    const outFile = path.resolve(os.tmpdir(), `temp.${Date.now()}.${Math.random()}.avif`);

    await pipeline(
      this.fixture.readBinaryStream('lincoln.jpg'),
      ImageUtil.transform({
        w: 200,
        h: 200,
        format: 'avif'
      }),
      createWriteStream(outFile)
    );

    assert.ok(
      await fs.stat(outFile).then(
        () => true,
        () => false
      )
    );

    const meta = await ImageUtil.getMetadata(createReadStream(outFile));
    assert(meta.width === 200);
    assert(meta.height === 200);

    // Verify the format is avif
    assert(meta.format === 'avif');

    await fs.unlink(outFile);
    assert(
      await fs.stat(outFile).then(
        () => false,
        () => true
      )
    );
  }
}
