import { Request, Response } from 'express';
import { AssetUtil, AssetFile } from '@encore/asset';
import { RouteRegistry } from '@encore/express';
import { nodeToPromise } from '@encore/base';
import { AssetExpressConfig } from '../config';
import { Class } from '@encore/di';

const match = require('mime-match');
const multiparty = require('connect-multiparty');

function readTypeArr(arr?: string[] | string) {
  return (Array.isArray(arr) ? arr : (arr || '').split(',')).filter(x => !!x);
}

function matchType(types: string[], type: string, invert: boolean = false) {
  if (types.length) {
    let matches = types.filter(match(type));
    return invert ? matches.length === 0 : matches.length > 0;
  }
  return false;
}

export function AssetUpload(config: Partial<AssetExpressConfig> = {}) {
  let conf = new AssetExpressConfig();
  (conf as any).postConstruct(); // Load config manually, bypassing dep-inj

  config = Object.assign({}, conf, config);

  let multipart = multiparty({
    hash: 'sha256',
    maxFilesSize: config.maxSize
  });

  let allowedTypes = readTypeArr(config.allowedTypes);
  let excludeTypes = readTypeArr(config.excludeTypes);

  return (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
    let rh = RouteRegistry.getOrCreateRequestHandlerConfig(target.constructor as Class, descriptor.value);
    const filt = async function (this: any, req: Request, res: Response) {
      await nodeToPromise<void>(null, multipart, req, res);

      for (let f of Object.keys(req.files)) {
        let contentType = (await AssetUtil.detectFileType(req.files[f].path)).mime;

        if (matchType(allowedTypes, contentType, true) || matchType(excludeTypes, contentType)) {
          throw { message: `Content type not allowed: ${contentType}`, status: 403 };
        }

        req.files[f] = AssetUtil.fileToAsset(req.files[f] as any as AssetFile, (target.constructor as any).basePath + '/');
      }
    }
    rh.filters!.unshift(filt);
    return descriptor;
  };
}