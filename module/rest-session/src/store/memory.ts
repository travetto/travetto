import { Session } from '../types';
import { SessionStore } from './store';

export class MemoryStore extends SessionStore {
  storage = new Map<string, Session>();

  async load(id: string) {
    return this.storage.get(id);
  }

  async store(session: Session<any>) {
    this.storage.set(session.id, session);
  }

  async destroy(session: Session) {
    return this.storage.delete(session.id);
  }
}