import type { CompilerServerEvent, CompilerServerEventType } from '../support/types';

export class EventUtil {
  static sendEvent<K extends CompilerServerEventType, T extends CompilerServerEvent & { type: K }>(type: K, payload: T['payload']): void {
    process.connected && process.send!({ type, payload });
  }
}