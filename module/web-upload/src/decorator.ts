import { AppError, toConcrete, ClassInstance } from '@travetto/runtime';
import { ControllerRegistry, EndpointParamConfig, Param, WebSymbols } from '@travetto/web';
import { SchemaRegistry } from '@travetto/schema';

import { WebUploadInterceptor } from './interceptor';
import { WebUploadConfig } from './config';
import { FileMap } from './types';

type UploadConfig = Partial<Pick<WebUploadConfig, 'types' | 'maxSize' | 'cleanupFiles'>>;

const FileMapContract = toConcrete<FileMap>();

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

  return (inst: ClassInstance, prop: string, idx: number): void => {
    const field = SchemaRegistry.getMethodSchema(inst.constructor, prop)[idx];

    if (!(field.type === Blob || field.type === File || field.type === FileMapContract)) {
      throw new AppError(`Cannot use upload decorator with ${field.type.name}, but only an ${Blob.name}, ${File.name} or ${FileMapContract.name}`);
    }

    const isMap = field.type === FileMapContract;

    // Register field
    ControllerRegistry.registerEndpointInterceptorConfig(
      inst.constructor, inst[prop], WebUploadInterceptor,
      {
        maxSize: finalConf.maxSize,
        types: finalConf.types,
        cleanupFiles: finalConf.cleanupFiles,
        uploads: isMap ? {} : {
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
      extract: (c, r) => {
        const map = r[WebSymbols.Internal].uploads!;
        return isMap ? map : map[c.name!];
      }
    })(inst, prop, idx);
  };
}