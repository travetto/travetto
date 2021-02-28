/// <reference path="./typings.d.ts" />

import { Class, AppError, ClassInstance } from '@travetto/base';
import { ControllerRegistry, Request, ParamConfig } from '@travetto/rest';
import { AssetImpl } from '@travetto/asset/src/internal/types';
import { DependencyRegistry } from '@travetto/di';

import { AssetRestUtil } from './util';
import { RestAssetConfig } from './config';

const extractUpload = (config: ParamConfig, req: Request) => req.files[config.name!];

const doUpload =
  (config: Partial<RestAssetConfig>) =>
    async (req: Request) => {
      if (!req.files) { // Prevent duplication if given multiple decorators
        const assetConfig = await DependencyRegistry.getInstance(RestAssetConfig);
        req.files = await AssetRestUtil.upload(req, { ...assetConfig, ...config });
      }
    };

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
    const handler = target[propertyKey];
    ControllerRegistry.registerEndpointParameter(target.constructor as Class, handler, {
      ...param as ParamConfig,
      location: 'files' as 'body',
      resolve: doUpload(finalConf),
      extract: extractUpload
    }, index);
  };
}

/**
 * Allows for supporting uploads
 *
 * @augments `@trv:asset-rest/AssetUpload`
 * @augments `@trv:rest/Endpoint`
 */
export function UploadAll(config: Partial<ParamConfig> & Partial<RestAssetConfig> = {}) {
  return function (target: ClassInstance, propertyKey: string) {
    ControllerRegistry.registerEndpointFilter(
      target.constructor as Class,
      target[propertyKey],
      doUpload(config)
    );
  };
}
