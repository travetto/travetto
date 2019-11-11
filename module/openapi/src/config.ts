import { Config } from '@travetto/config';
import { FsUtil } from '@travetto/boot';
import { AppInfo } from '@travetto/base';
import { ServerObject, ContactObject, LicenseObject } from 'openapi3-ts';

@Config('api.info')
export class ApiInfoConfig {
  contact: ContactObject = AppInfo.AUTHOR;
  description: string = AppInfo.DESCRIPTION;
  license: LicenseObject = { name: AppInfo.LICENSE };
  termsOfService?: string;
  title: string = AppInfo.NAME;
  version: string = AppInfo.VERSION;
}

@Config('api.host')
export class ApiHostConfig {
  servers?: ServerObject[];
  openapi = '3.0.1';
}

@Config('api.spec')
export class ApiSpecConfig {
  output: string = 'openapi.json';
  skipRoutes: boolean = false;
  exposeAllSchemas: boolean = false;

  postConstruct() {
    this.output = FsUtil.toUnix(this.output);
  }
}