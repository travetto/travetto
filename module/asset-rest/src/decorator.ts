import { Class, AppError, ClassInstance } from '@travetto/base';
import { ControllerRegistry, ParamConfig, Param, RouteHandler } from '@travetto/rest';
import { AssetImpl } from '@travetto/asset/src/internal/types';
import { SchemaRegistry } from '@travetto/schema';
import { RequestTarget } from '@travetto/rest/src/internal/types';

import { RestAssetInterceptor } from './interceptor';
import { RestAssetConfig } from './config';

type UploadConfig = Partial<Pick<RestAssetConfig, 'types' | 'maxSize' | 'deleteFiles'>>;

/**
 * Allows for supporting uploads
 *
 * @augments `@trv:asset-rest/Upload`
 * @augments `@trv:rest/Param`
 */
export function Upload(
  param: string | Partial<ParamConfig> & UploadConfig = {}
): (inst: ClassInstance, prop: string, idx: number) => void {

  if (typeof param === 'string') {
    param = { name: param };
  }

  const finalConf = { ...param };

  if (finalConf.contextType !== AssetImpl) {
    throw new AppError('Cannot use upload decorator with anything but an Asset', 'general');
  }

  return (inst: ClassInstance, prop: string, idx: number): void => {
    // Register field
    SchemaRegistry.registerPendingParamConfig(inst.constructor, prop, idx, Object, { specifier: 'file' });
    ControllerRegistry.registerEndpointInterceptorConfig(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      inst.constructor, inst[prop] as RouteHandler, RestAssetInterceptor,
      {
        files: {
          [finalConf.name ?? prop]: {
            maxSize: finalConf.maxSize,
            types: finalConf.types,
            deleteFiles: finalConf.deleteFiles
          }
        }
      }
    );

    return Param('body', {
      ...finalConf,
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
export function UploadAll(config: Partial<ParamConfig> & UploadConfig = {}) {
  return function (target: ClassInstance, propertyKey: string): void {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const targetClass = target.constructor as Class;

    const { params } = ControllerRegistry.getOrCreatePendingField(targetClass, target[propertyKey]);

    // Find the request object, and mark it as a file param
    params?.some((el, i) => {
      if (el.contextType === RequestTarget) {
        SchemaRegistry.registerPendingParamConfig(target.constructor, propertyKey, i, Object, { specifier: 'file' });
        return true;
      }
    });

    ControllerRegistry.registerEndpointInterceptorConfig(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      target.constructor, target[propertyKey] as RouteHandler,
      RestAssetInterceptor,
      {
        maxSize: config.maxSize,
        types: config.types,
        deleteFiles: config.deleteFiles
      }
    );
  };
}
