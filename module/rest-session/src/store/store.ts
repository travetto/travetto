import { Util } from '@travetto/base';

import { Session } from '../types';

const HALF_HOUR = 30 * 60 * 1000;

export abstract class SessionStore {
  async validate(id: string): Promise<boolean> {
    return !!(await this.get(id));
  }
  async create(payload: any, expiresAt?: number) {
    const id = Util.uuid();
    const sess: Session = {
      id,
      issuedAt: Date.now(),
      expiresAt: expiresAt || (Date.now() + HALF_HOUR),
      payload
    };
    return this.set(id, sess);
  }
  abstract get(id: string): Promise<Session | undefined>;
  abstract set(id: string, data: Session, extend?: boolean): Promise<void>;
  abstract destroy(id: string): Promise<boolean>;
}
