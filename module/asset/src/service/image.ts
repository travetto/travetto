import * as fs from 'fs';
import * as util from 'util';

import { DockerContainer } from '@travetto/exec';
import { Cacheable } from '@travetto/cache';
import { Injectable } from '@travetto/di';

import { AssetService } from './asset';
import { Asset, AssetMetadata } from '../model';
import { AssetUtil } from '../util';

const fsUnlinkAsync = util.promisify(fs.unlink);
const fsWriteFile = util.promisify(fs.writeFile);

@Injectable()
export class ImageService {

  private gm: DockerContainer;

  constructor(private assetService: AssetService) {
  }

  async postConstruct() {
    this.gm = new DockerContainer('rafakato/alpine-graphicsmagick')
      .forceDestroyOnShutdown()
      .setInteractive(true);

    await this.gm.create([], ['/bin/sh']);
    await this.gm.start();
  }

  @Cacheable({
    max: 1000,
    dispose: (key: string, n: Promise<string | undefined>) => {
      n.then(v => v ? fsUnlinkAsync(v) : undefined).catch(err => { });
    }
  })
  async generateAndStoreImage(filename: string, options: { w: number, h: number }, hasTags?: string[]): Promise<string | undefined> {
    const info = await this.assetService.get(filename, hasTags);
    if (!info.stream) {
      throw new Error('Stream not found');
    }
    if (options && (options.w || options.h)) {
      const filePath = AssetUtil.generateTempFile(info.filename.split('.').pop() as string);
      const [proc, prom] = await this.gm.exec(['-i'], [
        'gm', 'convert', '-resize', `${options.w}x${options.h}`, '-auto-orient', '-', '-'
      ]);
      info.stream.pipe(proc.stdin);
      proc.stdout.pipe(fs.createWriteStream(filePath));
      await prom;
      return filePath;
    }
  }

  async getImage(filename: string, options: { w: number, h: number }, hasTags?: string[]): Promise<Asset> {
    const file = await this.generateAndStoreImage(filename, options, hasTags);
    const info = await this.assetService.get(filename, hasTags);
    if (file) {
      info.stream = fs.createReadStream(file);
      delete info.length;
    }
    return info;
  }
}