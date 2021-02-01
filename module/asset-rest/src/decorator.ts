/// <reference path="./typings.d.ts" />

import { Class, AppError, ClassInstance } from '@travetto/base';
import { ControllerRegistry, Request, ParamConfig, ControllerConfig } from '@travetto/rest';
import { AssetImpl } from '@travetto/asset/src/internal/types';
import { DependencyRegistry } from '@travetto/di';

import { AssetRestUtil } from './util';
import { RestAssetConfig } from './config';

const extractUpload = (config: ParamConfig, req: Request) => req.files[config.name!];

/**
 * Allows for supporting uploads
 *
 * @augments `@trv:asset-rest/AssetUpload`
 * @augments `@trv:rest/Param`
 */
export function Upload(param: string | Partial<ParamConfig> & Partial<RestAssetConfig> = {}) {

  if (typeof param === 'string') {
    param = { name: param };
  }

  const finalConf = { ...param };

  if (finalConf.type !== AssetImpl) {
    throw new AppError('Cannot use upload decorator with anything but an Asset', 'general');
  }

  return function (target: ClassInstance, propertyKey: string, index: number) {
    const handler = target.constructor.prototype[propertyKey];
    ControllerRegistry.registerEndpointParameter(target.constructor as Class, handler, {
      ...param as ParamConfig,
      location: 'files' as 'body',
      async resolve(req: Request) {
        const assetConfig = await DependencyRegistry.getInstance(RestAssetConfig);

        if (!req.files) { // Prevent duplication if given multiple decorators
          req.files = await AssetRestUtil.upload(req, {
            ...assetConfig,
            ...finalConf
          });
        }
      },
      extract: extractUpload
    }, index);
  };
}