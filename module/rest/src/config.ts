import { Config } from '@travetto/config';
import { Env, AppError } from '@travetto/base';

import { SSLUtil } from './util/ssl';
import { Method } from './types';

@Config('rest')
export class RestConfig {
  serve = true;
  port = 3000;
  disableGetCache = true;

  ssl?: boolean;
  keys?: {
    cert: string,
    key: string
  };

  cors: {
    active: boolean;
    origins?: string[],
    methods?: Method[],
    headers?: string[]
  } = {
      active: false
    };

  async getKeys() {
    if (!this.keys) {
      if (Env.prod) {
        throw new AppError('Cannot use test keys in production', 'permissions');
      }
      return SSLUtil.generateKeyPair('/C=US/ST=CA/O=TRAVETTO/OU=REST/CN=DEV');
    } else {
      return this.keys;
    }
  }
}
