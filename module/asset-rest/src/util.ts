import * as path from 'path';
import * as os from 'os';
import * as busboy from 'busboy';

import { Request, Response, NodeRequestSym, NodeResponseSym } from '@travetto/rest';
import { Asset, AssetUtil } from '@travetto/asset';
import { AppError } from '@travetto/base';
import { FsUtil, StreamUtil } from '@travetto/boot';

import { RestAssetConfig } from './config';

type AssetMap = Record<string, Asset>;

/**
 * General support for handling file uploads/downloads
 */
export class AssetRestUtil {

  /**
   * Create a mime type validator
   */
  static mimeValidator(allowedTypes: string[] = [], excludedTypes: string[] = []) {

    const cached = Object.fromEntries(
      [...allowedTypes, ...excludedTypes].map(mime =>
        [mime, (mime.endsWith('/*') || !mime.includes('/')) ? new RegExp(`^${mime.replace(/[\/][*]$/, '')}\/.*`) : new RegExp(`^${mime}$`)]
      )
    );

    return <T extends { contentType: string }>(asset: T) => {
      const matchPositive = !!allowedTypes.find(t => cached[t].test(asset.contentType));
      const matchNegative = !!excludedTypes.find(t => cached[t].test(asset.contentType));

      if (
        (excludedTypes.length && matchNegative) ||
        (allowedTypes.length && !matchPositive)) {
        throw new AppError(`Content type not allowed: ${asset.contentType}`, 'data');
      }
      return asset;
    };
  }

  /**
   * Stream file to disk, and verify types in the process.  Produce an asset as the output
   */
  static async toLocalAsset(data: NodeJS.ReadableStream | Buffer, filename: string) {
    const uniqueDir = FsUtil.resolveUnix(os.tmpdir(), `rnd.${Math.random()}.${Date.now()}`);
    await FsUtil.mkdirp(uniqueDir); // TODO: Unique dir for each file? Use random file, and override metadata
    const uniqueLocal = FsUtil.resolveUnix(uniqueDir, path.basename(filename));

    await StreamUtil.writeToFile(data, uniqueLocal);
    const asset = await AssetUtil.fileToAsset(uniqueLocal);
    return asset;
  }

  /**
   * Parse filename from the request headers
   */
  static getFileName(req: Request) {
    const filenameExtract = /filename[*]?=["]?([^";]*)["]?/;
    const matches = (req.header('content-disposition') as string ?? '').match(filenameExtract);
    if (matches && matches.length) {
      return matches[1];
    } else {
      const [, type] = (req.header('content-type') as string)?.split('/') ?? [];
      return `file-upload.${type}`;
    }
  }

  /**
   * Actually process upload
   */
  static upload(req: Request, config: Partial<RestAssetConfig>) {
    const validator = this.mimeValidator(config.allowedTypesList, config.excludedTypesList);

    if (!/multipart|urlencoded/i.test(req.header('content-type') as string)) {
      const filename = this.getFileName(req);
      return this.toLocalAsset(req.body ?? req[NodeRequestSym], filename)
        .then(validator)
        .then(file => ({ file }));
    } else {
      return new Promise<AssetMap>((resolve, reject) => {
        const mapping: AssetMap = {};
        const uploads: Promise<Asset>[] = [];
        const uploader = new busboy({
          headers: req.headers,
          limits: {
            fileSize: config.maxSize
          }
        });

        uploader.on('file', async (fieldName, stream, filename, encoding, mimeType) => {
          console.debug('Uploading file', { fieldName, filename, encoding, mimeType });
          uploads.push(
            this.toLocalAsset(stream, filename)
              .then(validator)
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
      /**
       * @returns {Asset}
       */
      async render(res: Response) {
        const stream = asset.stream!;
        res.status(200);
        res.setHeader('Content-Type', asset.contentType);
        res.setHeader('Content-Disposition', `attachment;filename=${path.basename(asset.filename)}`);
        await new Promise((resolve, reject) => {
          stream.pipe(res[NodeResponseSym]);
          res[NodeResponseSym].on('error', reject);
          res[NodeResponseSym].on('drain', resolve);
          res[NodeResponseSym].on('close', resolve);
        });
      }
    };
  }
}