import { Config } from '@travetto/config';
import { AppInfo, FsUtil } from '@travetto/boot';

import { Contact, License } from './types';

@Config('api.info')
export class ApiInfoConfig {
  contact: Contact = AppInfo.AUTHOR;
  description: string = AppInfo.DESCRIPTION;
  license: License = { name: AppInfo.LICENSE };
  termsOfService?: string;
  title: string = AppInfo.NAME;
  version: string = AppInfo.VERSION;
}

@Config('api.host')
export class ApiHostConfig {
  basePath: string = '/';
  host?: string = 'localhost';
  swagger = '2.0';
}

@Config('api.client')
export class ApiClientConfig {
  codeGenImage: string = 'swaggerapi/swagger-codegen-cli';
  output: string = '';
  format?: string = '';
  formatOptions?: string = '';
  skipRoutes: boolean = false;
  exposeAllSchemas: boolean = false;

  postConstruct() {
    this.output = FsUtil.toUnix(this.output);
  }
}