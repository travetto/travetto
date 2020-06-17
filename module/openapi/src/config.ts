import * as path from 'path';
import { ServerObject, ContactObject, LicenseObject } from 'openapi3-ts';

import { Config } from '@travetto/config';
import { FsUtil, EnvUtil } from '@travetto/boot';
import { AppManifest } from '@travetto/base';

/**
 * API Information, infers as much as possible from the package.json
 */
@Config('api.info')
export class ApiInfoConfig {
  contact: ContactObject = AppManifest.author ?? {};
  description: string = AppManifest.description;
  license: LicenseObject = { name: AppManifest.license! };
  termsOfService?: string;
  title: string = AppManifest.name;
  version: string = AppManifest.version;
}

/**
 * The API host, infers from rest host configuration
 */
@Config('api.host')
export class ApiHostConfig {
  /**
   * List of servers
   */
  servers?: ServerObject[];
  /**
   * OpenAPI Version
   */
  openapi = '3.0.1';
}

/**
 * The spec file configuration
 */
@Config('api.spec')
export class ApiSpecConfig {
  /**
   * Where to output file to
   */
  output: string = 'openapi.json';
  /**
   * Should file be generated at runtime
   */
  persist: boolean = !EnvUtil.isReadonly();
  /**
   * Skip emitting all routes
   */
  skipRoutes: boolean = false;
  /**
   * Expose all schemas, even if not referenced
   */
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