/// <reference path="./typings.d.ts" />

import { ControllerRegistry, Filter, EndpointDecorator, Request, Response, MimeType } from '@travetto/rest';
import { Class } from '@travetto/registry';
import { ConfigSource } from '@travetto/config';

import { UploadUtil } from './upload-util';
import { AssetRestConfig } from './config';

const globalConf = new AssetRestConfig();
ConfigSource.bindTo(globalConf, 'rest.upload');

export function AssetUpload(config: Partial<AssetRestConfig> = {}) {

  const finalCOnf = { ...globalConf, ...config };

  return function (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<Filter>) {
    const ep = ControllerRegistry.getOrCreateEndpointConfig(target.constructor as Class, descriptor.value!);
    const filter = async function (req: Request, res: Response) {
      req.files = await UploadUtil.upload(req, finalCOnf, `${(target.constructor as any).basePath}/`);
    };

    ep.requestType = { type: 'file', mime: MimeType.MULTIPART };

    ep.filters!.unshift(filter);
    return descriptor;
  } as EndpointDecorator;
}