import { Config } from '@travetto/config';
import { AppInfo } from '@travetto/base';

import { Contact, License } from '../types';

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
  host?: string;
  swagger = '2.0';
}