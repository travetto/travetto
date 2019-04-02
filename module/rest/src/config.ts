import * as cookies from 'cookies';

import { Config } from '@travetto/config';
import { AppError } from '@travetto/base';
import { Env } from '@travetto/base/bootstrap';

import { SSLUtil } from './util/ssl';
import { Method } from './types';

@Config('rest')
export class RestConfig {
  serve = true;
  port = 3000;
  disableGetCache = true;
  trustProxy = false;

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

  async getKeys() {
    if (this.ssl.active) {
      if (!this.ssl.keys) {
        if (Env.prod) {
          throw new AppError('Cannot use test keys in production', 'permissions');
        }
        return SSLUtil.generateKeyPair('/C=US/ST=CA/O=TRAVETTO/OU=REST/CN=DEV');
      } else {
        return this.ssl.keys;
      }
    }
  }
}
