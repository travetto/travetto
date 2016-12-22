import { Request, Response } from 'express';
import { AssetUtil } from '../util';
import { RouteRegistry } from '@encore/express';
import { nodeToPromise } from '@encore/util';

let multipart = require('connect-multiparty')({
  hash: 'sha256'
});

function doUpload(after?: (req: Request) => Promise<any>) {
  return (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
    let clz = target.constructor;
    RouteRegistry.filterAdder(async (req: Request, res: Response) => {
      await nodeToPromise<void>(null, multipart, req, res);

      Object.keys(req.files).forEach(f =>
        req.files[f] = AssetUtil.uploadToAsset(req.files[f] as any as Express.MultipartyUpload, (clz as any).basePath + '/'));

      if (after) {
        await after(req);
      }

    })(target, propertyKey, descriptor);
  };
}

export function Upload() {
  return doUpload();
}