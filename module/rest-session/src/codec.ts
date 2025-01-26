import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { Request, Response } from '@travetto/rest';

import { Session } from './session';

@Config('rest.session')
export class RestSessionConfig {
  /**
   * Auth output key name
   */
  keyName = 'trv_sid';
  /**
   * Location for auth
   */
  transport: 'cookie' | 'header' = 'cookie';
}

@Injectable()
export class SessionCodec {

  @Inject()
  config: RestSessionConfig;

  read(req: Request): Promise<string | undefined> | string | undefined {
    return this.config.transport === 'cookie' ?
      req.cookies.get(this.config.keyName) :
      req.headerFirst(this.config.keyName);
  }

  async write(res: Response, value: Session | null | undefined): Promise<void> {
    if (this.config.transport === 'cookie' && value !== undefined) {
      res.cookies.set(this.config.keyName, value?.id ?? null, {
        expires: value?.expiresAt ?? new Date(),
        maxAge: undefined
      });
    } else if (this.config.transport === 'header' && value?.action === 'create') {
      res.setHeader(this.config.keyName, value.id);
    }
  }
}
