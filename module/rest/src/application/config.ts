import os from 'os';

import { Config, EnvVar } from '@travetto/config';
import { Required } from '@travetto/schema';

import { RestSslConfig } from './ssl';

/**
 * Restful configuration
 */
@Config('rest')
export class RestConfig {
  /**
   * Should the app run
   */
  serve = true;
  /**
   * The port to listen to
   */
  @EnvVar('REST_PORT')
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
   * Should the app provide the global route for app info
   */
  defaultMessage = true;

  /**
   * SSL Configuration
   */
  ssl?: RestSslConfig;

  /**
   * Redefine base url to be the full URL if not specified
   */
  postConstruct(): void {
    if (!this.bindAddress) {
      const useIPv4 = !![...Object.values(os.networkInterfaces())]
        .find(nics => nics?.find(nic => nic.family === 'IPv4'));

      this.bindAddress = useIPv4 ? '0.0.0.0' : '::';
    }
    this.baseUrl ??= `http${this.ssl?.active ? 's' : ''}://${this.hostname}${[80, 443].includes(this.port) ? '' : `:${this.port}`}`;
  }
}
