import { RuntimeError, toConcrete, type ClassInstance, getClass } from '@travetto/runtime';
import { ControllerRegistryIndex, type EndpointParameterConfig, Param } from '@travetto/web';
import { SchemaRegistryIndex } from '@travetto/schema';

import { WebUploadInterceptor } from './interceptor.ts';
import type { WebUploadConfig } from './config.ts';
import type { FileMap } from './types.ts';
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
): (instance: ClassInstance, property: string, idx: number) => void {

  const finalConfig = { ...param };

  return (instance: ClassInstance, property: string, idx: number): void => {
    // Register field
    const cls = getClass(instance);
    const adapter = ControllerRegistryIndex.getForRegister(cls);
    const getName = (): string => SchemaRegistryIndex.get(cls).getMethod(property).parameters[idx].name!;

    adapter.registerFinalizeHandler(() => {
      adapter.registerEndpointInterceptorConfig(
        property,
        WebUploadInterceptor,
        {
          applies: true,
          maxSize: finalConfig.maxSize,
          types: finalConfig.types,
          cleanupFiles: finalConfig.cleanupFiles,
          uploads: {
            [getName()]: {
              maxSize: finalConfig.maxSize,
              types: finalConfig.types,
              cleanupFiles: finalConfig.cleanupFiles
            }
          }
        }
      );
    });

    return Param('body', {
      ...finalConfig,
      extract: (request) => {
        const input = SchemaRegistryIndex.get(cls).getMethod(property).parameters[idx];

        if (!input) {
          throw new RuntimeError(`Unknown field type, ensure you are using ${Blob.name}, ${File.name} or ${FileMapContract.name}`);
        }

        if (!(input.type === Blob || input.type === File || input.type === FileMapContract)) {
          throw new RuntimeError(`Cannot use upload decorator with ${input.type.name}, but only an ${Blob.name}, ${File.name} or ${FileMapContract.name}`);
        }

        const isMap = input.type === FileMapContract;
        const map = WebUploadUtil.getRequestUploads(request);
        return isMap ? map : map[getName()];
      }
    })(instance, property, idx);
  };
}