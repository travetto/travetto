import { ServerObject, ContactObject, LicenseObject } from 'openapi3-ts/src/model/OpenApi';

import { Config } from '@travetto/config';
import { path, RootIndex } from '@travetto/manifest';
import { GlobalEnv } from '@travetto/base';
import { Required } from '@travetto/schema';


/**
 * API Information, infers as much as possible from the package.json
 */
@Config('api.info')
export class ApiInfoConfig {
  @Required(false)
  contact: ContactObject;
  @Required(false)
  description?: string;
  @Required(false)
  license: LicenseObject;
  @Required(false)
  termsOfService?: string;
  @Required(false)
  title: string;
  @Required(false)
  version: string;

  postConstruct(): void {
    const info = RootIndex.mainPackage;
    this.contact ??= info.author ?? {};
    this.description ??= info.description;
    this.license ??= { name: info.license! };
    this.title ??= info.name;
    this.version ??= info.version;
  }
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
  persist?: boolean;
  /**
   * Skip emitting all routes
   */
  skipRoutes: boolean = false;
  /**
   * Expose all schemas, even if not referenced
   */
  exposeAllSchemas: boolean = false;

  async postConstruct(): Promise<void> {
    this.output = path.toPosix(this.output);
    if (!this.output || this.output === '-') {
      this.persist = false;
    } else {
      this.persist ??= GlobalEnv.dynamic;
    }
    if (this.persist) {
      if (!/[.](json|ya?ml)$/.test(this.output)) { // Assume a folder
        this.output = path.resolve(this.output, 'openapi.yml');
      }
    }
  }
}