import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

import { ImageConverter } from '@travetto/image';

export class ResizeService {
  async resizeImage(imgPath: string, width: number, height: number): Promise<string> {
    const stream = await ImageConverter.resize(createReadStream(imgPath), { w: width, h: height });
    const out = imgPath.replace(/[.][^.]+$/, (ext) => `.resized${ext}`);
    await pipeline(stream, createWriteStream(out));
    return out;
  }
}