import type { ServerObject, ContactObject, LicenseObject } from 'openapi3-ts/oas31';

import { Config } from '@travetto/config';
import { path, RuntimeIndex, RuntimeManifest } from '@travetto/manifest';
import { Env } from '@travetto/base';
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
    this.title ??= RuntimeManifest.mainModule;
    this.version ??= RuntimeManifest.version;
    this.description ??= RuntimeManifest.description;
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
  openapi = '3.0.0';
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
    if (!this.output || this.output === '-') {
      this.persist = false;
    } else {
      this.output = path.resolve(RuntimeIndex.mainModule.sourcePath, this.output);
      this.persist ??= Env.dynamic;
    }
    if (this.persist) {
      if (!/[.](json|ya?ml)$/.test(this.output)) { // Assume a folder
        this.output = path.resolve(this.output, 'openapi.yml');
      }
    }
  }
}