import * as path from 'path';

import { Config } from '@travetto/config';
import { AppInfo } from '@travetto/base';

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

  postConstruct() {
    this.output = path.resolve(this.output);
  }
}