import * as path from 'path';
import * as fs from 'fs';
import * as LRU from 'lru-cache';
import * as gm from 'gm';

import { AssetService } from './asset';
import { File } from '../model';
import { nodeToPromise } from '@encore/util';
import { generateTempFile } from '../util';

export class ImageService {
  private static imageCache = LRU<string>({
    max: 1000,
    dispose: (key: string, n: string) => fs.unlink(n)
  });

  static clear() {
    ImageService.imageCache.reset();
  }

  static async getImage(filename: string, options: { w: number, h: number }, filter?: any): Promise<File> {
    let info = await AssetService.get(filename, filter);
    if (options && (options.w || options.h)) {
      let key = `${filename}${JSON.stringify(options)}`;
      let res = ImageService.imageCache.get(key);

      if (!res) {
        let filePath = generateTempFile(info.filename.split('.').pop() as string);
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

  static onExit(exit: boolean, err: any) {
    if (err) {
      console.log(err.stack || err);
    }
    ImageService.clear();
    if (exit) {
      process.exit();
    }
  }
}

process.on('exit', ImageService.onExit.bind(null, false));
process.on('SIGINT', ImageService.onExit.bind(null, true));
process.on('uncaughtException', ImageService.onExit.bind(null, true));