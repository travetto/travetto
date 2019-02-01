import * as fs from 'fs';
import * as util from 'util';

import { Injectable } from '@travetto/di';

import { Asset } from '../model';
import { AssetSource } from '../source';

const fsUnlink = util.promisify(fs.unlink);

@Injectable()
export class AssetService {

  constructor(private source: AssetSource) { }

  async remove(path: string) {
    return await this.source.remove(path);
  }

  async save(asset: Asset, upsert = true, removeOnComplete = true) {
    try {
      let res: Asset | undefined;
      try {
        res = await this.source.info(asset.filename);
      } catch (e) {
        // Not found
      }

      if (res && !upsert) {
        throw new Error(`File already exists: ${asset.filename}`);
      } else {
        return await this.source.write(asset, fs.createReadStream(asset.path));
      }

    } finally {
      if (removeOnComplete) {
        try {
          await fsUnlink(asset.path);
        } catch (e) {
          // Do nothings
        }
      }
    }
  }

  async saveAll(uploads: Asset[]) {
    return await Promise.all(uploads.map(u => this.save(u)));
  }

  async get(filename: string, haveTags?: string[]): Promise<Asset> {
    const info = await this.source.info(filename);
    if (haveTags) {
      const fin = new Set(info.metadata.tags);
      for (const t of haveTags) {
        if (!fin.has(t)) {
          throw new Error();
        }
      }
    }
    if (info.metadata.title) {
      info.filename = info.metadata.title;
    }
    info.stream = await this.source.read(filename);
    return info;
  }
}