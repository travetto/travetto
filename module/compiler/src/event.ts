import type { CompilerEvent, CompilerEventType } from '../support/types.ts';

export class EventUtil {
  static sendEvent<K extends CompilerEventType, T extends CompilerEvent & { type: K }>(type: K, payload: T['payload']): void {
    process.connected && process.send!({ type, payload }, undefined, undefined, () => { });
  }
}