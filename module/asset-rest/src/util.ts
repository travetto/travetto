import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as busboy from 'busboy';
import match = require('mime-match');

import { Request, Response, TRV_RAW } from '@travetto/rest';
import { Asset, AssetUtil } from '@travetto/asset';
import { AppError, SystemUtil } from '@travetto/base';
import { FsUtil } from '@travetto/boot';

import { RestAssetConfig } from './config';

type AssetMap = Record<string, Asset>;

/**
 * General support for handling file uploads/downloads
 */
export class AssetRestUtil {

  /**
   * Stream file to disk, and verify types in the process.  Produce an asset as the output
   */
  static async streamToLocalAsset(data: NodeJS.ReadableStream, fileName: string, allowedTypes: string[], excludedTypes: string[]) {
    const uniqueDir = FsUtil.resolveUnix(os.tmpdir(), `rnd.${Math.random()}.${Date.now()}`);
    await FsUtil.mkdirp(uniqueDir); // TODO: Unique dir for each file? Use random file, and override metadata
    const uniqueLocal = FsUtil.resolveUnix(uniqueDir, path.basename(fileName));

    await SystemUtil.streamToFile(data, uniqueLocal);

    const asset = await AssetUtil.fileToAsset(uniqueLocal);

    const notMatchPositive = allowedTypes.length && !allowedTypes.find(match(asset.contentType));
    const matchNegative = excludedTypes.length && !!excludedTypes.find(match(asset.contentType));

    if (notMatchPositive || matchNegative) {
      throw new AppError(`Content type not allowed: ${asset.contentType}`, 'data');
    }

    return asset;
  }

  /**
   * Parse filename from the request headers
   */
  static getFileName(req: Request) {
    const fileNameExtract = /filename[*]?=["]?([^";]*)["]?/;
    const matches = (req.header('content-disposition') as string ?? '').match(fileNameExtract);
    if (matches && matches.length) {
      return matches[1];
    } else {
      const [, type] = (req.header('content-type') as string).split('/');
      return `file-upload.${type}`;
    }
  }

  /**
   * Actually process upload
   */
  static upload(req: Request, config: Partial<RestAssetConfig>, relativeRoot?: string) {
    const allowedTypes = config.allowedTypesList!;
    const excludedTypes = config.excludedTypesList!;

    if (!/multipart|urlencoded/i.test(req.header('content-type') as string)) {
      const filename = this.getFileName(req);
      return this.streamToLocalAsset(req as any as NodeJS.ReadableStream, filename, allowedTypes, excludedTypes)
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
            this.streamToLocalAsset(file, fileName, allowedTypes, excludedTypes)
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

  /**
   * Make any asset downloadable
   */
  static downloadable(asset: Asset) {
    return {
      async render(res: Response) {
        const stream = asset.stream ?? fs.createReadStream(asset.path);
        res.status(200);
        res.setHeader('Content-Type', asset.contentType);
        res.setHeader('Content-Disposition', `attachment;filename=${asset.path}`);
        await new Promise((resolve, reject) => {
          stream.pipe(res[TRV_RAW]);
          res[TRV_RAW].on('error', reject);
          res[TRV_RAW].on('drain', resolve);
          res[TRV_RAW].on('close', resolve);
        });
      }
    };
  }
}