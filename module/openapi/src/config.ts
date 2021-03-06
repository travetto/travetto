import * as path from 'path';
import { ServerObject, ContactObject, LicenseObject } from 'openapi3-ts';

import { Config } from '@travetto/config';
import { PathUtil, EnvUtil, FsUtil } from '@travetto/boot';
import { AppManifest } from '@travetto/base';

/**
 * API Information, infers as much as possible from the package.json
 */
@Config('api.info')
export class ApiInfoConfig {
  contact: ContactObject = AppManifest.info.author ?? {};
  description?: string = AppManifest.info.description;
  license: LicenseObject = { name: AppManifest.info.license! };
  termsOfService?: string;
  title: string = AppManifest.info.name;
  version?: string = AppManifest.info.version;
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
  output: string = 'openapi.yml';
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
    this.output = PathUtil.toUnix(this.output);
    if (!this.output || this.output === '-') {
      this.persist = false;
    }
    if (this.persist) {
      if (!/[.](json|ya?ml)$/.test(this.output)) { // Assume a folder
        this.output = PathUtil.resolveUnix(this.output, 'openapi.yml');
      }
      await FsUtil.mkdirp(path.dirname(this.output));
    }
  }
}