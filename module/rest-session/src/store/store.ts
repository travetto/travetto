import { Util } from '@travetto/base';

import { Session } from '../types';

export abstract class SessionStore {
  async validate(session: Session): Promise<boolean> {
    return !!(await this.load(session.id!));
  }
  async create(payload: any, maxAge: number) {
    const sess: Session = new Session({
      id: Util.uuid(),
      issuedAt: new Date(),
      maxAge,
      payload
    });
    return sess;
  }
  abstract load(id: string): Promise<Session | undefined>;
  abstract store(data: Session): Promise<void>;
  abstract destroy(session: Session): Promise<boolean>;
}
