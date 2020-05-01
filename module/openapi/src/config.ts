import { Config } from '@travetto/config';
import { FsUtil } from '@travetto/boot';
import { AppInfo } from '@travetto/base';
import { ServerObject, ContactObject, LicenseObject } from 'openapi3-ts';

@Config('api.info')
// TODO: Document
export class ApiInfoConfig {
  contact: ContactObject = AppInfo.author;
  description: string = AppInfo.description;
  license: LicenseObject = { name: AppInfo.license };
  termsOfService?: string;
  title: string = AppInfo.name;
  version: string = AppInfo.version;
}

@Config('api.host')
// TODO: Document
export class ApiHostConfig {
  servers?: ServerObject[];
  openapi = '3.0.1';
}

@Config('api.spec')
// TODO: Document
export class ApiSpecConfig {
  output: string = 'openapi.json';
  skipRoutes: boolean = false;
  exposeAllSchemas: boolean = false;

  postConstruct() {
    this.output = FsUtil.toUnix(this.output);
  }
}