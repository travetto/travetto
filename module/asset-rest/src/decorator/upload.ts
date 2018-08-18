import * as util from 'util';

import { AssetUtil, AssetFile } from '@travetto/asset';
import { ControllerRegistry, Filter, EndpointDecorator, Request, Response } from '@travetto/rest';
import { Class } from '@travetto/registry';

import { AssetRestConfig } from '../config';

const match = require('mime-match');
const multiparty = require('connect-multiparty');

function readTypeArr(arr?: string[] | string) {
  return (Array.isArray(arr) ? arr : (arr || '').split(',')).filter(x => !!x);
}

function matchType(types: string[], type: string, invert: boolean = false) {
  if (types.length) {
    const matches = types.filter(match(type));
    return invert ? matches.length === 0 : matches.length > 0;
  }
  return false;
}

export function AssetUpload(config: Partial<AssetRestConfig> = {}) {
  const conf = new AssetRestConfig();
  (conf as any).postConstruct(); // Load config manually, bypassing dep-inj

  config = { ...conf, ...config };

  const multipart = multiparty({
    hash: 'sha256',
    maxFilesSize: config.maxSize
  });

  const multipartAsync = util.promisify(multipart);

  const allowedTypes = readTypeArr(config.allowedTypes);
  const excludeTypes = readTypeArr(config.excludeTypes);

  return function (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<Filter>) {
    const ep = ControllerRegistry.getOrCreateEndpointConfig(target.constructor as Class, descriptor.value!);
    const filter = async function (req: Request, res: Response) {
      await multipartAsync(req, res);

      for (const f of Object.keys(req.files)) {
        const contentType = (await AssetUtil.detectFileType(req.files[f].path)).mime;

        if (matchType(allowedTypes, contentType, true) || matchType(excludeTypes, contentType)) {
          throw { message: `Content type not allowed: ${contentType}`, status: 403 };
        }

        req.files[f] = AssetUtil.fileToAsset(req.files[f] as any as AssetFile, `${(target.constructor as any).basePath}/`);
      }
    };

    ep.filters!.unshift(filter);
    return descriptor;
  } as EndpointDecorator;
}