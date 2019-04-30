import * as fs from 'fs';
import * as path from 'path';

import { CommandService } from '@travetto/exec';
import { Cacheable } from '@travetto/cache';
import { Injectable } from '@travetto/di';

import { AssetService } from './asset';
import { Asset } from '../model';
import { AssetUtil } from '../util';
import { ImageOptions } from '../types';

@Injectable()
export class ImageService {

  converter = new CommandService({
    containerImage: 'v4tech/imagemagick',
    localCheck: ['convert', ['--version']]
  });

  constructor(private assetService: AssetService) { }

  @Cacheable({
    max: 1000,
    dispose: (v: string | undefined, key: string) => {
      if (v) {
        fs.unlink(v, err => {
          console.log(err);
        });
      }
    }
  })
  async generateAndStoreImage(filename: string, options: ImageOptions, hasTags?: string[]): Promise<string | undefined> {
    const info = await this.assetService.get(filename, hasTags);
    if (!info.stream) {
      throw new Error('Stream not found');
    }
    if (options && (options.w || options.h)) {
      const filePath = AssetUtil.generateTempFile(path.extname(info.filename).substr(1));

      const { process: proc, result: prom } = await this.converter.exec('convert', '-resize', `${options.w}x${options.h}`, '-auto-orient', '-', '-');

      info.stream.pipe(proc.stdin!);
      proc.stdout!.pipe(fs.createWriteStream(filePath));
      await prom;
      return filePath;
    }
  }

  async getImage(filename: string, options: ImageOptions, hasTags?: string[]): Promise<Asset> {
    const file = await this.generateAndStoreImage(filename, options, hasTags);
    const info = await this.assetService.get(filename, hasTags);
    if (file) {
      info.stream = fs.createReadStream(file);
      delete info.length;
    }
    return info;
  }
}