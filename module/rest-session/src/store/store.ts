import { Util } from '@travetto/base';

import { Session } from '../types';

const HALF_HOUR = 30 * 60 * 1000;

export abstract class SessionStore {
  async validate(session: Session): Promise<boolean> {
    return !!(await this.load(session.id));
  }
  async create(payload: any, expiresAt?: number) {
    const id = Util.uuid();
    const sess: Session = {
      id,
      issuedAt: Date.now(),
      expiresAt: expiresAt || (Date.now() + HALF_HOUR),
      payload
    };
    this.store(sess);
    return sess;
  }
  abstract load(id: string): Promise<Session | undefined>;
  abstract store(data: Session, extend?: boolean): Promise<void>;
  abstract destroy(session: Session): Promise<boolean>;
}
