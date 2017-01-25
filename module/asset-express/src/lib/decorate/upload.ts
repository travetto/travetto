import { Request, Response } from 'express';
import { AssetUtil } from '../util';
import { RouteRegistry } from '@encore/express';
import { nodeToPromise } from '@encore/util';
import Config from '../config';

const match = require('mime-match');

type UploadConfig = { allowedTypes?: string[] | string, excludeTypes?: string[] | string, maxSize?: number };

function readTypeArr(arr?: string[] | string) {
  return Array.isArray(arr) ? arr : (arr || '').split(',');
}

function matchType(types: string[], type: string, invert: boolean = false) {
  if (types.length) {
    let matches = types.filter(match(type));
    return invert ? matches.length === 0 : matches.length > 0;
  }
  return false;
}

function doUpload(config: UploadConfig, after?: (req: Request) => Promise<any>) {
  let multipart = require('connect-multiparty')({
    hash: 'sha256',
    maxFilesSize: Config.maxSize
  });

  let allowedTypes = readTypeArr(config.allowedTypes);
  let excludeTypes = readTypeArr(config.excludeTypes);

  return (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
    let clz = target.constructor;
    RouteRegistry.filterAdder(async (req: Request, res: Response) => {
      await nodeToPromise<void>(null, multipart, req, res);

      for (let f of Object.keys(req.files)) {
        let contentType = (await AssetUtil.detectFileType(req.files[f].path)).mime;

        if (matchType(allowedTypes, contentType, true) || matchType(excludeTypes, contentType)) {
          throw { message: `Content type not allowed: ${contentType}`, status: 403 };
        }

        req.files[f] = AssetUtil.uploadToAsset(req.files[f] as any as Express.MultipartyUpload, (clz as any).basePath + '/');

        if (after) {
          await after(req);
        }
      }
    })(target, propertyKey, descriptor);
  };
}

export function Upload(config: UploadConfig = {}) {
  return doUpload(Object.assign({}, Config, config));
}