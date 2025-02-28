import { AppError, toConcrete, asConstructable, AsyncMethodDescriptor, ClassInstance } from '@travetto/runtime';
import { ControllerRegistry, ParamConfig, Param, HttpRequest } from '@travetto/web';
import { SchemaRegistry } from '@travetto/schema';

import { WebUploadInterceptor } from './interceptor';
import { WebUploadConfig } from './config';

type UploadConfig = Partial<Pick<WebUploadConfig, 'types' | 'maxSize' | 'cleanupFiles'>>;

/**
 * Allows for supporting uploads
 *
 * @augments `@travetto/web-upload:Upload`
 * @augments `@travetto/web:Param`
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
      inst.constructor, inst[prop], WebUploadInterceptor,
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
 * @augments `@travetto/web-upload:Upload`
 * @augments `@travetto/web:Endpoint`
 */
export function UploadAll(config: Partial<ParamConfig> & UploadConfig = {}) {
  const RequestTarget = toConcrete<HttpRequest>();

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
      WebUploadInterceptor,
      {
        maxSize: config.maxSize,
        types: config.types,
        cleanupFiles: config.cleanupFiles
      }
    );
  };
}
