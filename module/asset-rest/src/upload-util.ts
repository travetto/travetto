import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as busboy from 'busboy';
import * as util from 'util';
import match = require('mime-match');

import { Request, AppError } from '@travetto/rest';
import { Asset, AssetUtil } from '@travetto/asset';

import { AssetRestConfig } from './config';

type AssetMap = { [key: string]: Asset };

export class UploadUtil {
  static readTypeArr(arr?: string[] | string) {
    return (Array.isArray(arr) ? arr : (arr || '').split(',')).filter(x => !!x);
  }

  static matchType(types: string[], type: string, invert: boolean = false) {
    if (types.length) {
      const matches = types.filter(match(type));
      return invert ? matches.length === 0 : matches.length > 0;
    }
    return false;
  }

  static upload(req: Request, config: Partial<AssetRestConfig>, relativeRoot?: string) {
    const allowedTypes = this.readTypeArr(config.allowedTypes);
    const excludeTypes = this.readTypeArr(config.excludeTypes);

    console.log('Staring upload');

    return new Promise<AssetMap>((resolve, reject) => {
      const mapping: AssetMap = {};
      const uploads: Promise<any>[] = [];
      const uploader = new busboy({
        headers: req.headers,
        limits: {
          fileSize: config.maxSize
        }
      });

      uploader.on('file', async (fieldName, file, fileName, encoding, mimeType) => {
        console.log('Uploading file', fieldName, fileName, encoding, mimeType);

        uploads.push((async () => {
          const uniqueDir = path.join(os.tmpdir(), `rnd.${Math.random()}.${Date.now()}`);
          await util.promisify(fs.mkdir)(uniqueDir);
          const uniqueLocal = path.join(uniqueDir, path.basename(fileName));

          file.pipe(fs.createWriteStream(uniqueLocal));
          await util.promisify(file.on).call(file, 'end');

          const asset = mapping[fieldName] = await AssetUtil.localFileToAsset(uniqueLocal, relativeRoot);
          asset.metadata.title = fileName;
          asset.metadata.name = fileName;
          asset.filename = fileName;

          const contentType = (await AssetUtil.detectFileType(asset.path)).mime;

          if (
            this.matchType(allowedTypes, contentType, true) ||
            this.matchType(excludeTypes, contentType)
          ) {
            throw new AppError(`Content type not allowed: ${contentType}`, 403);
          }
        })());
      });

      uploader.on('finish', async () => {
        console.log('Finishing Upload');

        try {
          await Promise.all(uploads);
          console.log('Finished Upload');
          resolve(mapping);
        } catch (err) {
          reject(err);
        }
      });

      req.pipe(uploader);
    });
  }
}