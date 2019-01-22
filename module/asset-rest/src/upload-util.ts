import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as busboy from 'busboy';
import match = require('mime-match');

import { FsUtil } from '@travetto/base';
import { Request, RestError } from '@travetto/rest';
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

    console.debug('Staring upload');

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
        console.debug('Uploading file', fieldName, fileName, encoding, mimeType);

        uploads.push((async () => {
          const uniqueDir = path.resolve(os.tmpdir(), `rnd.${Math.random()}.${Date.now()}`);
          await FsUtil.mkdirpAsync(uniqueDir);
          const uniqueLocal = path.resolve(uniqueDir, path.basename(fileName));

          file.pipe(fs.createWriteStream(uniqueLocal));
          await new Promise((res, rej) =>
            file.on('end', e => e ? rej(e) : res()));

          const asset = mapping[fieldName] = await AssetUtil.localFileToAsset(uniqueLocal, relativeRoot);
          asset.metadata.title = fileName;
          asset.metadata.name = fileName;
          asset.filename = fileName;

          const detectedType = await AssetUtil.detectFileType(asset.path);
          const contentType = detectedType ? detectedType.mime : '';

          if (
            this.matchType(allowedTypes, contentType, true) ||
            this.matchType(excludeTypes, contentType)
          ) {
            throw new RestError(`Content type not allowed: ${contentType}`, 403);
          }
        })());
      });

      uploader.on('finish', async () => {
        console.debug('Finishing Upload');

        try {
          await Promise.all(uploads);
          console.debug('Finished Upload');
          resolve(mapping);
        } catch (err) {
          reject(err);
        }
      });

      req.pipe(uploader);
    });
  }
}