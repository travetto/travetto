import { Class, AppError, ClassInstance } from '@travetto/base';
import { ControllerRegistry, Request, ParamConfig, Param } from '@travetto/rest';
import { AssetImpl } from '@travetto/asset/src/internal/types';
import { DependencyRegistry } from '@travetto/di';
import { SchemaRegistry } from '@travetto/schema';
import { RequestTarget } from '@travetto/rest/src/internal/types';

import { AssetRestUtil } from './util';
import { RestAssetConfig } from './config';

const doUpload = (config: Partial<RestAssetConfig>) =>
  async (req: Request) => {
    if (!req.files) { // Prevent duplication if given multiple decorators
      const assetConfig = await DependencyRegistry.getInstance(RestAssetConfig);
      req.files = await AssetRestUtil.upload(req, { ...assetConfig, ...config });
    }
  };

/**
 * Allows for supporting uploads
 *
 * @augments `@trv:asset-rest/Upload`
 * @augments `@trv:rest/Param`
 */
export function Upload(param: string | Partial<ParamConfig> & Partial<RestAssetConfig> = {}) {

  if (typeof param === 'string') {
    param = { name: param };
  }

  const finalConf = { ...param };

  if (finalConf.contextType !== AssetImpl) {
    throw new AppError('Cannot use upload decorator with anything but an Asset', 'general');
  }

  return (inst: ClassInstance, prop: string, idx: number) => {

    // Register field
    SchemaRegistry.registerPendingParamConfig(inst.constructor, prop, idx, Object, { specifier: 'file' });

    return Param('body', {
      ...finalConf,
      resolve: doUpload(finalConf),
      extract: (config, req) => req?.files[config.name!]
    })(inst, prop, idx);
  };
}

/**
 * Allows for supporting uploads
 *
 * @augments `@trv:asset-rest/Upload`
 * @augments `@trv:rest/Endpoint`
 */
export function UploadAll(config: Partial<ParamConfig> & Partial<RestAssetConfig> = {}) {
  return function (target: ClassInstance, propertyKey: string) {
    // Assuming first param is a file
    const { params } = ControllerRegistry.getOrCreatePendingField(target.constructor as Class, target[propertyKey]);

    // Find the request object, and mark it as a file param
    params?.some((el, i) => {
      if (el.contextType === RequestTarget) {
        SchemaRegistry.registerPendingParamConfig(target.constructor, propertyKey, i, Object, { specifier: 'file' });
        return true;
      }
    });

    ControllerRegistry.registerEndpointFilter(
      target.constructor as Class,
      target[propertyKey],
      doUpload(config)
    );
  };
}
