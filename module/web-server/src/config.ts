import { Config, EnvVar } from '@travetto/config';
import { Secret } from '@travetto/schema';
import { AppError, Runtime, RuntimeResources } from '@travetto/runtime';
import { NetUtil } from '@travetto/web';

import { WebSslKeyPair } from './types.ts';
import { WebSslUtil } from './ssl.ts';

/**
 * Web HTTP configuration
 */
@Config('web.http')
export class WebHttpConfig {
  /**
   * The port to run on
   */
  @EnvVar('WEB_HTTP_PORT', 'WEB_PORT')
  port: number = 3000;

  /**
   * The bind address, defaults to 0.0.0.0
   */
  bindAddress: string = '';

  /**
   * Is SSL active
   */
  @EnvVar('WEB_HTTP_SSL')
  ssl?: boolean;

  /**
   * SSL Keys
   */
  @Secret()
  sslKeys?: WebSslKeyPair;

  async postConstruct(): Promise<void> {
    this.ssl ??= !!this.sslKeys;
    this.port = (this.port < 0 ? await NetUtil.getFreePort() : this.port);
    this.bindAddress ||= await NetUtil.getLocalAddress();

    if (!this.ssl) {
      // Clear out keys if ssl is not set
      this.sslKeys = undefined;
    } else if (!this.sslKeys) {
      if (Runtime.production) {
        throw new AppError('Default ssl keys are only valid for development use, please specify a config value at web.ssl.keys');
      }
      this.sslKeys = await WebSslUtil.generateKeyPair();
    } else {
      if (this.sslKeys.key.length < 100) { // We have files or resources
        this.sslKeys.key = (await RuntimeResources.read(this.sslKeys.key, true)).toString('utf8');
        this.sslKeys.cert = (await RuntimeResources.read(this.sslKeys.cert, true)).toString('utf8');
      }
    }
  }
}