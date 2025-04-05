import { AppError, toConcrete, ClassInstance } from '@travetto/runtime';
import { ControllerRegistry, EndpointParamConfig, WebInternalSymbol, Param } from '@travetto/web';
import { SchemaRegistry } from '@travetto/schema';

import { WebUploadInterceptor } from './interceptor.ts';
import { WebUploadConfig } from './config.ts';
import { FileMap } from './types.ts';

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
): (inst: ClassInstance, prop: string, idx: number) => void {

  if (typeof param === 'string') {
    param = { name: param };
  }

  const finalConf = { ...param };

  return (inst: ClassInstance, prop: string, idx: number): void => {
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
      extract: (ctx, config) => {
        const field = SchemaRegistry.getMethodSchema(inst.constructor, prop)[idx];

        if (!field) {
          throw new AppError(`Unknown field type, ensure you are using ${Blob.name}, ${File.name} or ${FileMapContract.name}`);
        }

        if (!(field.type === Blob || field.type === File || field.type === FileMapContract)) {
          throw new AppError(`Cannot use upload decorator with ${field.type.name}, but only an ${Blob.name}, ${File.name} or ${FileMapContract.name}`);
        }

        const isMap = field.type === FileMapContract;
        const map = ctx.req[WebInternalSymbol].uploads!;
        return isMap ? map : map[config.name!];
      }
    })(inst, prop, idx);
  };
}