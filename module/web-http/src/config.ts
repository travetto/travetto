import { Config, EnvVar } from '@travetto/config';
import { PostConstruct } from '@travetto/di';
import { RuntimeError, RuntimeResources } from '@travetto/runtime';
import { Ignore, Secret } from '@travetto/schema';
import { NetUtil } from '@travetto/web';

import type { WebSecureCert } from './types.ts';

/**
 * Web HTTP configuration
 */
@Config('web.http')
export class WebHttpConfig {
  /**
   * What version of HTTP to use
   * Version 2 requires SSL for direct browser access
   */
  @EnvVar('WEB_HTTP_VERSION')
  httpVersion: '1.1' | '2' = '1.1';

  /**
   * The port to run on
   */
  @EnvVar('WEB_HTTP_PORT')
  port: number = 3000;

  /**
   * The bind address, defaults to 0.0.0.0
   */
  bindAddress: string = '';

  /**
   * Is TLS active
   */
  @EnvVar('WEB_HTTP_TLS')
  tls?: boolean;

  /**
   * TLS Keys
   */
  @Secret()
  tlsKeys?: WebSecureCert;

  @Ignore()
  fetchUrl: string;

  @PostConstruct()
  async finalizeConfig(): Promise<void> {
    this.tls ??= this.httpVersion === '2' || !!this.tlsKeys;
    this.port = this.port < 0 ? await NetUtil.getFreePort() : this.port;
    this.bindAddress ||= NetUtil.getLocalAddress();

    if (!this.tls) {
      // Clear out keys if tls is not set
      this.tlsKeys = undefined;
    } else if (this.tlsKeys) {
      if (this.tlsKeys.key.length < 100) {
        // We have files or resources
        this.tlsKeys.key = await RuntimeResources.readUTF8(this.tlsKeys.key);
        this.tlsKeys.cert = await RuntimeResources.readUTF8(this.tlsKeys.cert);
      }
    } else {
      throw new RuntimeError(
        'TLS requested, but no keys provided.  Please specify a config value at web.tls.keys or web.tlsKeys, or run `npx trv web:tls-dev` to generate a local cert.',
        {
          category: 'notfound'
        }
      );
    }

    this.fetchUrl = `${this.tls ? 'https' : 'http'}://${this.bindAddress}:${this.port}`;
  }
}
