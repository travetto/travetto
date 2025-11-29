import { AppError, toConcrete, ClassInstance, getClass } from '@travetto/runtime';
import { ControllerRegistryIndex, EndpointParameterConfig, Param } from '@travetto/web';
import { SchemaRegistryIndex } from '@travetto/schema';

import { WebUploadInterceptor } from './interceptor.ts';
import { WebUploadConfig } from './config.ts';
import { FileMap } from './types.ts';
import { WebUploadUtil } from './util.ts';

type UploadConfig = Partial<Pick<WebUploadConfig, 'types' | 'maxSize' | 'cleanupFiles'>>;

const FileMapContract = toConcrete<FileMap>();

/**
 * Allows for supporting uploads
 *
 * @augments `@travetto/schema:Input`
 * @kind decorator
 */
export function Upload(
  param: Partial<EndpointParameterConfig> & UploadConfig = {},
): (instance: ClassInstance, property: string | symbol, idx: number) => void {

  const finalConf = { ...param };

  return (instance: ClassInstance, property: string | symbol, idx: number): void => {
    // Register field
    const cls = ControllerRegistryIndex.getForRegister(getClass(instance));
    const getName = (): string => SchemaRegistryIndex.getMethodConfig(instance.constructor, property).parameters[idx].name!.toString();

    cls.registerFinalizeHandler(() => {
      cls.registerEndpointInterceptorConfig(
        property,
        WebUploadInterceptor,
        {
          applies: true,
          maxSize: finalConf.maxSize,
          types: finalConf.types,
          cleanupFiles: finalConf.cleanupFiles,
          uploads: {
            [getName()]: {
              maxSize: finalConf.maxSize,
              types: finalConf.types,
              cleanupFiles: finalConf.cleanupFiles
            }
          }
        }
      );
    });

    return Param('body', {
      ...finalConf,
      extract: (request) => {
        const input = SchemaRegistryIndex.getMethodConfig(instance.constructor, property).parameters[idx];

        if (!input) {
          throw new AppError(`Unknown field type, ensure you are using ${Blob.name}, ${File.name} or ${FileMapContract.name}`);
        }

        if (!(input.type === Blob || input.type === File || input.type === FileMapContract)) {
          throw new AppError(`Cannot use upload decorator with ${input.type.name}, but only an ${Blob.name}, ${File.name} or ${FileMapContract.name}`);
        }

        const isMap = input.type === FileMapContract;
        const map = WebUploadUtil.getRequestUploads(request);
        return isMap ? map : map[getName()];
      }
    })(instance, property, idx);
  };
}