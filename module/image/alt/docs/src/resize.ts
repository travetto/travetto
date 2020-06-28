import * as fs from 'fs';

import { StreamUtil } from '@travetto/boot';
import { ImageUtil } from '../../../src/util';

export class ResizeService {
  async resizeImage(imgPath: string, width: number, height: number): Promise<string> {
    const stream = await ImageUtil.resize(fs.createReadStream(imgPath), { w: width, h: height });
    const out = imgPath.replace(/[.][^.]+$/, (ext) => `.resized${ext}`);
    await StreamUtil.writeToFile(stream, out);
    return out;
  }
}