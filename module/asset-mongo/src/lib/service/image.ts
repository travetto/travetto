import * as fs from 'fs';
import * as LRU from 'lru-cache';
import * as gm from 'gm';

import { AssetService } from './asset';
import { Asset } from '../model';
import { nodeToPromise } from '@encore/util';
import { AssetUtil } from '../util';
import { Shutdown } from '@encore/init';

export class ImageService {
  private static imageCache = LRU<string>({
    max: 1000,
    dispose: (key: string, n: string) => fs.unlink(n)
  });

  static clear() {
    ImageService.imageCache.reset();
  }

  static async getImage(filename: string, options: { w: number, h: number }, filter?: any): Promise<Asset> {
    let info = await AssetService.get(filename, filter);
    if (info.stream && options && (options.w || options.h)) {
      let key = `${filename}${JSON.stringify(options)}`;
      let res = ImageService.imageCache.get(key);

      if (!res) {
        let filePath = AssetUtil.generateTempFile(info.filename.split('.').pop() as string);
        let op = gm(info.stream, info.filename)
          .resize(options.w, options.h)
          .autoOrient();
        await nodeToPromise<void>(op, op.write, filePath);
        ImageService.imageCache.set(key, filePath);
      }

      info.stream = fs.createReadStream(ImageService.imageCache.get(key));
      delete info.length;
    }
    return info;
  }
}

Shutdown.onShutdown(() => ImageService.clear());