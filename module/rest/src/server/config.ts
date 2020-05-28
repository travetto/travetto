import * as os from 'os';

import { EnvUtil } from '@travetto/boot';
import { Config } from '@travetto/config';
import { AppError, ResourceManager } from '@travetto/base';

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
   * Disable cache on all gets, unless overridden
   */
  disableGetCache = true;
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
  postConstruct() {
    if (!this.bindAddress) {
      const useIPv4 = !![...Object.values(os.networkInterfaces())]
        .find(nics => nics.find(nic => nic.family === 'IPv4'));

      this.bindAddress = useIPv4 ? '0.0.0.0' : '::';
    }
    if (this.baseUrl === undefined) {
      this.baseUrl = `http${this.ssl.active ? 's' : ''}://${this.hostname}${[80, 443].includes(this.port) ? '' : `:${this.port}`}`;
    }
  }

  /**
   * Get SSL keys, will generate if missing, and in dev
   */
  async getKeys() {
    if (this.ssl.active) {
      if (!this.ssl.keys) {
        if (EnvUtil.isProd()) {
          throw new AppError('Cannot use test keys in production', 'permissions');
        }
        return RestServerUtil.generateSslKeyPair();
      } else {
        if (this.ssl.keys.key.length < 100) {
          this.ssl.keys.key = await ResourceManager.read(this.ssl.keys.key, 'utf8');
          this.ssl.keys.cert = await ResourceManager.read(this.ssl.keys.cert, 'utf8');
        }
        return this.ssl.keys;
      }
    }
  }
}
