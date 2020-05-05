import * as path from 'path';
import { ServerObject, ContactObject, LicenseObject } from 'openapi3-ts';

import { Config } from '@travetto/config';
import { FsUtil } from '@travetto/boot';
import { AppInfo, Env } from '@travetto/base';

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
  persist: boolean = !Env.prod;
  skipRoutes: boolean = false;
  exposeAllSchemas: boolean = false;

  async postConstruct() {
    this.output = FsUtil.toUnix(this.output);
    if (this.persist) {
      if (!/[.](json|ya?ml)$/.test(this.output)) { // Assume a folder
        this.output = FsUtil.resolveUnix(this.output, 'api.spec.yml');
      }
      await FsUtil.mkdirp(path.dirname(this.output));
    }
  }
}