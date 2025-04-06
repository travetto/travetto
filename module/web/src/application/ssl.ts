import { AppError, Runtime, RuntimeResources } from '@travetto/runtime';
import { Config, EnvVar } from '@travetto/config';
import { Secret } from '@travetto/schema';

import { WebSslUtil } from '../util/ssl.ts';
import { WebSslKeyPair } from '../types/application.ts';

@Config('web.ssl')
export class WebSslConfig {

  /**
   * Enabled
   */
  @EnvVar('WEB_SSL')
  active: boolean = false;

  /**
   * SSL Keys
   */
  @Secret()
  keys?: WebSslKeyPair;

  /**
   * Get SSL keys, will generate if missing, and in dev
   */
  async getKeys(): Promise<WebSslKeyPair | undefined> {
    if (!this.active) {
      return;
    } else if (!this.keys) {
      if (Runtime.production) {
        throw new AppError('Default ssl keys are only valid for development use, please specify a config value at web.ssl.keys');
      }
      return WebSslUtil.generateKeyPair();
    } else {
      if (this.keys.key.length < 100) { // We have files or resources
        this.keys.key = (await RuntimeResources.read(this.keys.key, true)).toString('utf8');
        this.keys.cert = (await RuntimeResources.read(this.keys.cert, true)).toString('utf8');
      }
      return this.keys;
    }
  }
}
