import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

import { ImageUtil } from '@travetto/image';

export class ResizeService {
  async resizeImage(imgPath: string, width: number, height: number): Promise<string> {
    const out = imgPath.replace(/[.][^.]+$/, ext => `.resized${ext}`);
    await pipeline(
      /* Input */ createReadStream(imgPath),
      /* Transform */ ImageUtil.transform({ w: width, h: height }),
      /* Output */ createWriteStream(out)
    );
    return out;
  }
}
