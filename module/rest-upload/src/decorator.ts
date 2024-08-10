import { AppError, AsyncMethodDescriptor, castTo, ClassInstance } from '@travetto/runtime';
import { ControllerRegistry, ParamConfig, Param } from '@travetto/rest';
import { SchemaRegistry } from '@travetto/schema';
import { RequestTarget } from '@travetto/rest/src/internal/types';

import { RestAssetInterceptor } from './interceptor';
import { RestUploadConfig } from './config';

type UploadConfig = Partial<Pick<RestUploadConfig, 'types' | 'maxSize' | 'deleteFiles'>>;

/**
 * Allows for supporting uploads
 *
 * @augments `@travetto/rest-upload:Upload`
 * @augments `@travetto/rest:Param`
 */
export function Upload(
  param: string | Partial<ParamConfig> & UploadConfig = {}
): (inst: ClassInstance, prop: string, idx: number) => void {

  if (typeof param === 'string') {
    param = { name: param };
  }

  const finalConf = { ...param };

  if (!(finalConf.contextType === Blob || finalConf.contextType === File)) {
    throw new AppError(`Cannot use upload decorator with ${finalConf.contextType}, but only an Blob or File`, 'general');
  }

  return (inst: ClassInstance, prop: string, idx: number): void => {
    // Register field
    SchemaRegistry.registerPendingParamConfig(inst.constructor, prop, idx, Object, { specifiers: ['file'] });
    ControllerRegistry.registerEndpointInterceptorConfig(
      inst.constructor, inst[prop], RestAssetInterceptor,
      {
        maxSize: finalConf.maxSize,
        types: finalConf.types,
        deleteFiles: finalConf.deleteFiles,
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
 * @augments `@travetto/rest-upload:Upload`
 * @augments `@travetto/rest:Endpoint`
 */
export function UploadAll(config: Partial<ParamConfig> & UploadConfig = {}) {
  return function <T>(target: T, propertyKey: string, desc: AsyncMethodDescriptor): void {
    const inst = castTo<ClassInstance<T>>(target);
    const targetClass = inst.constructor;

    const { params } = ControllerRegistry.getOrCreatePendingField(targetClass, desc.value!);

    // Find the request object, and mark it as a file param
    params?.some((el, i) => {
      if (el.contextType === RequestTarget) {
        SchemaRegistry.registerPendingParamConfig(inst.constructor, propertyKey, i, Object, { specifiers: ['file'] });
        return true;
      }
    });

    ControllerRegistry.registerEndpointInterceptorConfig(
      inst.constructor, desc.value!,
      RestAssetInterceptor,
      {
        maxSize: config.maxSize,
        types: config.types,
        deleteFiles: config.deleteFiles
      }
    );
  };
}
