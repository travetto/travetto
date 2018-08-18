import { ControllerRegistry, Filter, EndpointDecorator, Request, Response } from '@travetto/rest';
import { Class } from '@travetto/registry';
import { ConfigLoader } from '@travetto/config';

import { UploadUtil } from '../upload-util';
import { AssetRestConfig } from '../config';

const globalConf = new AssetRestConfig();
ConfigLoader.bindTo(globalConf, 'rest.upload');

export function AssetUpload(config: Partial<AssetRestConfig> = {}) {

  const finalCOnf = { ...globalConf, ...config };

  return function (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<Filter>) {
    const ep = ControllerRegistry.getOrCreateEndpointConfig(target.constructor as Class, descriptor.value!);
    const filter = async function (req: Request, res: Response) {
      req.files = await UploadUtil.upload(req, finalCOnf, `${(target.constructor as any).basePath}/`);
    };

    ep.filters!.unshift(filter);
    return descriptor;
  } as EndpointDecorator;
}