import * as path from 'path';
import { ServerObject, ContactObject, LicenseObject } from 'openapi3-ts/src/model/OpenApi';

import { Config } from '@travetto/config';
import { EnvUtil } from '@travetto/boot';
import { AppManifest } from '@travetto/base';

/**
 * API Information, infers as much as possible from the package.json
 */
@Config('api.info', { internal: true })
export class ApiInfoConfig {
  contact: ContactObject = AppManifest.info.author ?? {};
  description?: string = AppManifest.info.description;
  license: LicenseObject = { name: AppManifest.info.license! };
  termsOfService?: string;
  title: string = AppManifest.info.name;
  version: string = AppManifest.info.version ?? '0.0.0';
}

/**
 * The API host, infers from rest host configuration
 */
@Config('api.host', { internal: true })
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
@Config('api.spec', { internal: true })
export class ApiSpecConfig {
  /**
   * Where to output file to
   */
  output: string = 'openapi.yml';
  /**
   * Should file be generated at runtime
   */
  persist: boolean = EnvUtil.isDynamic();
  /**
   * Skip emitting all routes
   */
  skipRoutes: boolean = false;
  /**
   * Expose all schemas, even if not referenced
   */
  exposeAllSchemas: boolean = false;

  async postConstruct(): Promise<void> {
    this.output = this.output.__posix;
    if (!this.output || this.output === '-') {
      this.persist = false;
    }
    if (this.persist) {
      if (!/[.](json|ya?ml)$/.test(this.output)) { // Assume a folder
        this.output = path.resolve(this.output, 'openapi.yml').__posix;
      }
    }
  }
}