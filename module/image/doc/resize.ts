import { createReadStream, createWriteStream } from 'node:fs';

import { ImageUtil } from '@travetto/image';
import { BinaryUtil } from '@travetto/runtime';

export class ResizeService {
  async resizeImage(imgPath: string, width: number, height: number): Promise<string> {
    const stream = await ImageUtil.convert(createReadStream(imgPath), { w: width, h: height });
    const out = imgPath.replace(/[.][^.]+$/, (ext) => `.resized${ext}`);
    await BinaryUtil.pipeline(stream, createWriteStream(out));
    return out;
  }
}