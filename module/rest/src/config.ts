import * as os from 'os';
import * as cookies from 'cookies';

import { Config } from '@travetto/config';
import { Env, AppError, ResourceManager } from '@travetto/base';

import { SSLUtil } from './util/ssl';
import { Method } from './types';

@Config('rest')
export class RestConfig {
  serve = true;
  port = 3000;
  disableGetCache = true;
  trustProxy = false;
  hostname = 'localhost';
  bindAddress?: string;
  baseUrl: string;

  defaultMessage = true;

  cookie: cookies.SetOption & { active: boolean, signed: boolean, keys: string[] } = {
    active: true,
    signed: true,
    httpOnly: true,
    sameSite: 'lax',
    keys: ['default-insecure']
  };

  ssl: {
    active?: boolean,
    keys?: {
      cert: string,
      key: string
    }
  } = {
      active: false
    };

  cors: {
    active: boolean;
    origins?: string[],
    methods?: Method[],
    headers?: string[],
    credentials?: boolean
  } = {
      active: false
    };

  postConstruct() {
    if (!this.bindAddress) {
      const useIPv4 = !![...Object.values(os.networkInterfaces())]
        .find(nics => nics.find(nic => nic.family === 'IPv4'));

      this.bindAddress = useIPv4 ? '0.0.0.0' : '::';
    }
    if (this.cookie.secure === undefined) {
      this.cookie.secure = this.ssl.active;
    }
    if (this.baseUrl === undefined) {
      this.baseUrl = `http${this.ssl.active ? 's' : ''}://${this.hostname}${[80, 443].includes(this.port) ? '' : `:${this.port}`}`;
    }
    if (this.cookie.domain === undefined) {
      this.cookie.domain = this.hostname;
    }
  }

  async getKeys() {
    if (this.ssl.active) {
      if (!this.ssl.keys) {
        if (Env.prod) {
          throw new AppError('Cannot use test keys in production', 'permissions');
        }
        return SSLUtil.generateKeyPair();
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
