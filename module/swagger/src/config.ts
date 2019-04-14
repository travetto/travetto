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
  servers?: ServerObject[] = [{ url: 'http://localhost:3000' }];
  openapi = '3.0.7';
}

@Config('api.client')
export class ApiClientConfig {
  codeGenImage: string = 'swaggerapi/swagger-codegen-cli-v3:3.0.7';
  output: string = '';
  format?: string = '';
  formatOptions?: string = '';
  skipRoutes: boolean = false;
  exposeAllSchemas: boolean = false;

  postConstruct() {
    this.output = FsUtil.toUnix(this.output);
  }
}