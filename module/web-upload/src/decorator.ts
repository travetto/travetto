import { AppError, toConcrete, asConstructable, AsyncMethodDescriptor, ClassInstance } from '@travetto/runtime';
import { ControllerRegistry, EndpointParamConfig, Param, HttpRequest } from '@travetto/web';
import { SchemaRegistry } from '@travetto/schema';

import { WebUploadInterceptor } from './interceptor';
import { WebUploadConfig } from './config';

const HttpRequestTarget = toConcrete<HttpRequest>();

type UploadConfig = Partial<Pick<WebUploadConfig, 'types' | 'maxSize' | 'cleanupFiles'>>;

/**
 * Allows for supporting uploads
 *
 * @augments `@travetto/web-upload:Upload`
 * @augments `@travetto/web:Param`
 */
export function Upload(
  param: string | Partial<EndpointParamConfig> & UploadConfig = {}
): (inst: ClassInstance, prop: string, idx: number) => void {

  if (typeof param === 'string') {
    param = { name: param };
  }

  const finalConf = { ...param };

  if (!(finalConf.field?.type === Blob || finalConf.field?.type === File)) {
    throw new AppError(`Cannot use upload decorator with ${finalConf.field?.type}, but only an Blob or File`);
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

    return Param('body', { ...finalConf, extract: (c, r) => r?.uploads[c.name!] })(inst, prop, idx);
  };
}

/**
 * Allows for supporting uploads
 *
 * @augments `@travetto/web-upload:Upload`
 * @augments `@travetto/web:Endpoint`
 */
export function UploadAll(config: Partial<EndpointParamConfig> & UploadConfig = {}) {
  return function <T>(target: T, propertyKey: string, desc: AsyncMethodDescriptor): void {
    const targetClass = asConstructable(target).constructor;

    const { params } = ControllerRegistry.getOrCreatePendingField(targetClass, desc.value!);

    // Find the request object, and mark it as a file param
    params?.some((el, i) => {
      if (el.field?.type === HttpRequestTarget) {
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
