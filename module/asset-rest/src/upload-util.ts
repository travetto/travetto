import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as busboy from 'busboy';
import match = require('mime-match');

import { Request } from '@travetto/rest';
import { Asset, AssetUtil } from '@travetto/asset';
import { AppError } from '@travetto/base';
import { FsUtil } from '@travetto/base/bootstrap';

import { AssetRestConfig } from './config';

type AssetMap = { [key: string]: Asset };

export class UploadUtil {
  static readTypeArr(arr?: string[] | string) {
    return (Array.isArray(arr) ? arr : (arr || '').split(',')).filter(x => !!x);
  }

  static matchType(types: string[], type: string) {
    return types.findIndex(match(type)) >= 0;
  }

  static async streamFile(data: NodeJS.ReadableStream, fileName: string, allowedTypes: string[], excludeTypes: string[], relativeRoot?: string) {
    const uniqueDir = FsUtil.resolveUnix(os.tmpdir(), `rnd.${Math.random()}.${Date.now()}`);
    await FsUtil.mkdirp(uniqueDir);
    const uniqueLocal = FsUtil.resolveUnix(uniqueDir, path.basename(fileName));

    data.pipe(fs.createWriteStream(uniqueLocal));
    await new Promise((res, rej) =>
      data.on('end', (e: any) => e ? rej(e) : res()));

    const asset = await AssetUtil.localFileToAsset(uniqueLocal, relativeRoot);
    asset.metadata.title = fileName;
    asset.metadata.name = fileName;
    asset.filename = fileName;

    const detectedType = await AssetUtil.detectFileType(asset.path);
    const contentType = detectedType ? detectedType.mime : '';

    const notMatchPositive = allowedTypes.length && !this.matchType(allowedTypes, contentType);
    const matchNegative = excludeTypes.length && this.matchType(excludeTypes, contentType);

    if (notMatchPositive || matchNegative) {
      throw new AppError(`Content type not allowed: ${contentType}`, 'data');
    }

    return asset;
  }

  static getFileName(req: Request) {
    return ((req.header('content-disposition') || '')
      .split('filename=')[1] || '')
      .replace(/"/g, '') ||
      `file-upload.${req.header('content-type')!.split('/').pop()}`;
  }

  static upload(req: Request, config: Partial<AssetRestConfig>, relativeRoot?: string) {
    const allowedTypes = this.readTypeArr(config.allowedTypes);
    const excludeTypes = this.readTypeArr(config.excludeTypes);

    return new Promise<AssetMap>((resolve, reject) => {
      if (!/multipart|urlencoded/i.test(req.header('content-type')!)) {
        const filename = this.getFileName(req);
        this.streamFile(req as any as NodeJS.ReadableStream, filename, allowedTypes, excludeTypes, relativeRoot)
          .then(file => resolve({ file }));
      } else {
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
      }
    });
  }
}