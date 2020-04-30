import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as busboy from 'busboy';
import match = require('mime-match');

import { Request, Response } from '@travetto/rest';
import { Asset, AssetUtil } from '@travetto/asset';
import { AppError, SystemUtil } from '@travetto/base';
import { FsUtil } from '@travetto/boot';

import { RestAssetConfig } from './config';

type AssetMap = Record<string, Asset>;

// TODO: Document
// TODO: Cleanup
export class AssetRestUtil {
  static readTypeArr(arr?: string[] | string) {
    return (Array.isArray(arr) ? arr : (arr ?? '').split(',')).filter(x => !!x);
  }

  static matchType(types: string[], type: string) {
    return types.findIndex(match(type)) >= 0;
  }

  static async streamFile(data: NodeJS.ReadableStream, fileName: string, allowedTypes: string[], excludeTypes: string[], relativeRoot?: string) {
    const uniqueDir = FsUtil.resolveUnix(os.tmpdir(), `rnd.${Math.random()}.${Date.now()}`);
    await FsUtil.mkdirp(uniqueDir);
    const uniqueLocal = FsUtil.resolveUnix(uniqueDir, path.basename(fileName));

    await SystemUtil.streamToFile(data, uniqueLocal);

    const asset = await AssetUtil.fileToAsset(uniqueLocal);

    const notMatchPositive = allowedTypes.length && !this.matchType(allowedTypes, asset.contentType);
    const matchNegative = excludeTypes.length && this.matchType(excludeTypes, asset.contentType);

    if (notMatchPositive || matchNegative) {
      throw new AppError(`Content type not allowed: ${asset.contentType}`, 'data');
    }

    return asset;
  }

  static getFileName(req: Request) {
    return ((req.header('content-disposition') as string ?? '')
      .split('filename=')[1] ?? '')
      .replace(/"/g, '') ||
      `file-upload.${(req.header('content-type') as string)!.split('/').pop()}`;
  }

  static upload(req: Request, config: Partial<RestAssetConfig>, relativeRoot?: string) {
    const allowedTypes = this.readTypeArr(config.allowedTypes);
    const excludeTypes = this.readTypeArr(config.excludeTypes);

    if (!/multipart|urlencoded/i.test(req.header('content-type') as string)) {
      const filename = this.getFileName(req);
      return this.streamFile(req as any as NodeJS.ReadableStream, filename, allowedTypes, excludeTypes, relativeRoot)
        .then(file => ({ file }));
    } else {
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
          uploads.push(
            this.streamFile(file, fileName, allowedTypes, excludeTypes, relativeRoot)
              .then(res => mapping[fieldName] = res)
          );
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

  static downloadable(asset: Asset) {
    return {
      async render(res: Response) {
        const stream = asset.stream ?? fs.createReadStream(asset.path);
        res.status(200);
        res.setHeader('Content-Type', asset.contentType);
        res.setHeader('Content-Disposition', `attachment;filename=${asset.path}`);
        await new Promise((resolve, reject) => {
          stream.pipe(res.__raw);
          res.__raw.on('error', reject);
          res.__raw.on('drain', resolve);
          res.__raw.on('close', resolve);
        });
      }
    };
  }
}