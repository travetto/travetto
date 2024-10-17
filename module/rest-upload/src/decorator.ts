import { AppError, asConstructable, AsyncMethodDescriptor, ClassInstance } from '@travetto/runtime';
import { ControllerRegistry, ParamConfig, Param } from '@travetto/rest';
import { SchemaRegistry } from '@travetto/schema';
import { RequestTarget } from '@travetto/rest/src/internal/types';

import { RestUploadInterceptor } from './interceptor';
import { RestUploadConfig } from './config';

type UploadConfig = Partial<Pick<RestUploadConfig, 'types' | 'maxSize' | 'cleanupFiles'>>;

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
    throw new AppError(`Cannot use upload decorator with ${finalConf.contextType}, but only an Blob or File`);
  }

  return (inst: ClassInstance, prop: string, idx: number): void => {
    // Register field
    SchemaRegistry.registerPendingParamConfig(inst.constructor, prop, idx, Object, { specifiers: ['file'] });
    ControllerRegistry.registerEndpointInterceptorConfig(
      inst.constructor, inst[prop], RestUploadInterceptor,
      {
        maxSize: finalConf.maxSize,
        types: finalConf.types,
        cleanupFiles: finalConf.cleanupFiles,
        uploads: {
          [finalConf.name ?? prop]: {
            maxSize: finalConf.maxSize,
            types: finalConf.types,
            cleanupFiles: finalConf.cleanupFiles
          }
        }
      }
    );

    return Param('body', {
      ...finalConf,
      extract: (config, req) => req?.uploads[config.name!]
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
    const targetClass = asConstructable(target).constructor;

    const { params } = ControllerRegistry.getOrCreatePendingField(targetClass, desc.value!);

    // Find the request object, and mark it as a file param
    params?.some((el, i) => {
      if (el.contextType === RequestTarget) {
        SchemaRegistry.registerPendingParamConfig(targetClass, propertyKey, i, Object, { specifiers: ['file'] });
        return true;
      }
    });

    ControllerRegistry.registerEndpointInterceptorConfig(
      targetClass, desc.value!,
      RestUploadInterceptor,
      {
        maxSize: config.maxSize,
        types: config.types,
        cleanupFiles: config.cleanupFiles
      }
    );
  };
}
