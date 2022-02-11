import { createReadStream } from 'fs';

import { StreamUtil } from '@travetto/boot';
import { ImageUtil } from '@travetto/image';

export class ResizeService {
  async resizeImage(imgPath: string, width: number, height: number): Promise<string> {
    const stream = await ImageUtil.resize(createReadStream(imgPath), { w: width, h: height });
    const out = imgPath.replace(/[.][^.]+$/, (ext) => `.resized${ext}`);
    await StreamUtil.writeToFile(stream, out);
    return out;
  }
}