/// <reference path="./typings.d.ts" />

import { ControllerRegistry, Request, ParamConfig } from '@travetto/rest';
import { Class } from '@travetto/registry';
import { ConfigSource } from '@travetto/config';

import { UploadUtil } from './upload-util';
import { AssetRestConfig } from './config';

const globalConf = new AssetRestConfig();
ConfigSource.bindTo(globalConf, 'rest.upload');

export function Upload(param: Partial<ParamConfig> & Partial<AssetRestConfig> = {}) {

  const finalConf = { ...globalConf, ...param };

  return function (target: Object, propertyKey: string, index: number) {
    const handler = target.constructor.prototype[propertyKey];
    ControllerRegistry.registerEndpointParameter(target.constructor as Class, handler, {
      ...param as ParamConfig,
      location: 'files' as any,
      async resolve(req: Request) {
        req.files = await UploadUtil.upload(req, finalConf, `${(target.constructor as any).basePath}/`);
      }
    }, index);
  };
}