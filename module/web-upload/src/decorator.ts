import { AppError, toConcrete, ClassInstance } from '@travetto/runtime';
import { ControllerRegistry, EndpointParamConfig, Param } from '@travetto/web';
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
 * @augments `@travetto/web-upload:Upload`
 * @augments `@travetto/web:Param`
 */
export function Upload(
  param: string | Partial<EndpointParamConfig> & UploadConfig = {},
): (inst: ClassInstance, prop: string | symbol, idx: number) => void {

  if (typeof param === 'string') {
    param = { name: param };
  }

  const finalConf = { ...param };

  return (inst: ClassInstance, prop: string | symbol, idx: number): void => {
    // Register field
    ControllerRegistry.registerEndpointInterceptorConfig(
      inst.constructor, inst[prop], WebUploadInterceptor,
      {
        applies: true,
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
      extract: (request, config) => {
        const input = SchemaRegistryIndex.get(inst.constructor).getMethod(prop).parameters[idx];

        if (!input) {
          throw new AppError(`Unknown field type, ensure you are using ${Blob.name}, ${File.name} or ${FileMapContract.name}`);
        }

        if (!(input.type === Blob || input.type === File || input.type === FileMapContract)) {
          throw new AppError(`Cannot use upload decorator with ${input.type.name}, but only an ${Blob.name}, ${File.name} or ${FileMapContract.name}`);
        }

        const isMap = input.type === FileMapContract;
        const map = WebUploadUtil.getRequestUploads(request);
        return isMap ? map : map[config.name!];
      }
    })(inst, prop, idx);
  };
}