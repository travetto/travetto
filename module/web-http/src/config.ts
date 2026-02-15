import { Config, EnvVar } from '@travetto/config';
import { Ignore, Secret } from '@travetto/schema';
import { RuntimeError, Runtime, RuntimeResources } from '@travetto/runtime';
import { NetUtil } from '@travetto/web';

import type { WebSecureKeyPair } from './types.ts';
import { WebTlsUtil } from './tls.ts';

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
  tlsKeys?: WebSecureKeyPair;

  @Ignore()
  fetchUrl: string;

  async postConstruct(): Promise<void> {
    this.tls ??= (this.httpVersion === '2' || !!this.tlsKeys);
    this.port = (this.port < 0 ? await NetUtil.getFreePort() : this.port);
    this.bindAddress ||= NetUtil.getLocalAddress();

    if (!this.tls) {
      // Clear out keys if tls is not set
      this.tlsKeys = undefined;
    } else if (!this.tlsKeys) {
      if (Runtime.production) {
        throw new RuntimeError('Default tls keys are only valid for development use, please specify a config value at web.tls.keys');
      }
      this.tlsKeys = await WebTlsUtil.generateKeyPair();
    } else {
      if (this.tlsKeys.key.length < 100) { // We have files or resources
        this.tlsKeys.key = await RuntimeResources.readText(this.tlsKeys.key);
        this.tlsKeys.cert = await RuntimeResources.readText(this.tlsKeys.cert);
      }
    }

    this.fetchUrl = `${this.tls ? 'https' : 'http'}://${this.bindAddress}:${this.port}`;
  }
}