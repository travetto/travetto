import os from 'node:os';

import { Config, EnvVar } from '@travetto/config';
import { Required } from '@travetto/schema';

import { WebSslConfig } from './ssl';

/**
 * Web configuration
 */
@Config('web')
export class WebConfig {
  /**
   * Should the app run
   */
  serve = true;
  /**
   * The port to listen to
   */
  @EnvVar('WEB_PORT')
  port = 3000;
  /**
   * Should we trust the proxy requests implicitly
   */
  trustProxy = false;
  /**
   * The hostname for the server
   */
  hostname = 'localhost';
  /**
   * The bind address, defaults to 0.0.0.0
   */
  bindAddress?: string;
  /**
   * The base url for the application
   */
  @Required(false)
  baseUrl: string;

  /**
   * Should the app provide the global endpoint for app info
   */
  defaultMessage = true;

  /**
   * SSL Configuration
   */
  ssl?: WebSslConfig;

  /**
   * Redefine base url to be the full URL if not specified
   */
  postConstruct(): void {
    if (!this.bindAddress) {
      const useIPv4 = !![...Object.values(os.networkInterfaces())]
        .find(interfaces => interfaces?.find(nic => nic.family === 'IPv4'));

      this.bindAddress = useIPv4 ? '0.0.0.0' : '::';
    }
    this.baseUrl ??= `http${this.ssl?.active ? 's' : ''}://${this.hostname}${[80, 443].includes(this.port) ? '' : `:${this.port}`}`;
  }
}
