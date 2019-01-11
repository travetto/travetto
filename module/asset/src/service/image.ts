import * as fs from 'fs';

import { CommandService, ExecUtil } from '@travetto/exec';
import { Cacheable } from '@travetto/cache';
import { Injectable } from '@travetto/di';
import { FsUtil } from '@travetto/base';

import { AssetService } from './asset';
import { Asset } from '../model';
import { AssetUtil } from '../util';
import { ImageOptions } from '../types';

@Injectable()
export class ImageService {

  converter = new CommandService({
    image: 'v4tech/imagemagick',
    checkForLocal: async () => {
      return (await ExecUtil.spawn('convert', ['--version'])[1]).valid;
    }
  });

  constructor(private assetService: AssetService) { }

  @Cacheable({
    max: 1000,
    dispose: (key: string, n: Promise<string | undefined>) => {
      n.then(v => v ? FsUtil.unlinkAsync(v) : undefined).catch(err => {
        console.error(err);
      });
    }
  })
  async generateAndStoreImage(filename: string, options: ImageOptions, hasTags?: string[]): Promise<string | undefined> {
    const info = await this.assetService.get(filename, hasTags);
    if (!info.stream) {
      throw new Error('Stream not found');
    }
    if (options && (options.w || options.h)) {
      const filePath = AssetUtil.generateTempFile(info.filename.split('.').pop() as string);

      const [proc, prom] = await this.converter.exec('convert', '-resize', `${options.w}x${options.h}`, '-auto-orient', '-', '-');

      info.stream.pipe(proc.stdin);
      proc.stdout.pipe(fs.createWriteStream(filePath));
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