import type { CompilerEvent, CompilerEventPayload, CompilerEventType } from './types.ts';

const VALID_EVENT_TYPES = new Set<CompilerEventType>(['change', 'log', 'progress', 'state', 'all', 'file']);

export class EventUtil {

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  static isComplilerEventType = (value: string): value is CompilerEventType => VALID_EVENT_TYPES.has(value as CompilerEventType);

  static isCompilerEvent = (value: unknown): value is CompilerEvent =>
    typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string' && EventUtil.isComplilerEventType(value.type);

  static sendEvent<K extends CompilerEventType, T extends CompilerEventPayload<K>>(type: K, payload: T): void {
    process.connected && process.send!({ type, payload }, undefined, undefined, () => { });
  }
}