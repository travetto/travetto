import * as os from 'os';

import { Config } from '@travetto/config';
import { Resources, Env, AppError } from '@travetto/base';
import { Required } from '@travetto/schema';

import { RestServerUtil } from './util';

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
  ssl: {
    /**
     * Enabled
     */
    active?: boolean;
    /**
     * SSL Keys
     */
    keys?: {
      cert: string;
      key: string;
    };
  } = { active: false };

  /**
   * Redefine base url to be the full URL if not specified
   */
  postConstruct(): void {
    if (!this.bindAddress) {
      const useIPv4 = !![...Object.values(os.networkInterfaces())]
        .find(nics => nics?.find(nic => nic.family === 'IPv4'));

      this.bindAddress = useIPv4 ? '0.0.0.0' : '::';
    }
    if (this.baseUrl === undefined) {
      this.baseUrl = `http${this.ssl.active ? 's' : ''}://${this.hostname}${[80, 443].includes(this.port) ? '' : `:${this.port}`}`;
    }
  }

  /**
   * Get SSL keys, will generate if missing, and in dev
   */
  async getKeys(): Promise<{
    key: string;
    cert: string;
  } | undefined> {
    if (!this.ssl.active) {
      return;
    }
    if (!this.ssl.keys) {
      if (Env.isProd()) {
        throw new AppError('Cannot use test keys in production', 'permissions');
      }
      return RestServerUtil.generateSslKeyPair();
    } else {
      if (this.ssl.keys.key.length < 100) {
        this.ssl.keys.key = await Resources.read(this.ssl.keys.key);
        this.ssl.keys.cert = await Resources.read(this.ssl.keys.cert);
      }
      return this.ssl.keys;
    }
  }
}
