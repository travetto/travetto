import { Session } from '../types';
import { SessionStore } from './store';

export class MemoryStore extends SessionStore {
  storage = new Map<string, Session>();

  async get(id: string) {
    return this.storage.get(id);
  }

  async set(id: string, session: Session<any>) {
    this.storage.set(id, session);
  }

  async destroy(id: string) {
    return this.storage.delete(id);
  }
}