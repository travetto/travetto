import { Env, AppError } from '@travetto/base';
import { Injectable } from '@travetto/di';

import { Session } from '../types';
import { SessionStore } from './store';

@Injectable()
export class MemoryStore extends SessionStore {
  storage = new Map<string, string>();

  postConstruct() {
    if (Env.dev) {
      console.warn('MemoryStore is not intended for production use');
    } else if (Env.prod) {
      throw new AppError('MemoryStore is not intended for production use', 'general');
    }
  }

  async load(id: string) {
    const res = this.storage.get(id);
    if (res) {
      try {
        return JSON.parse(res) as Session;
      } catch (err) {
        console.error('Unable to restore malformed session');
      }
    }
    return;
  }

  async store(session: Session<any>) {
    this.storage.set(session.id!, JSON.stringify(session)); // Break references, allow for GC
  }

  async destroy(session: Session) {
    return this.storage.delete(session.id!);
  }
}