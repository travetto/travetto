import { isRecordWithStringKey } from '@travetto/transformer';

import type { CompilerEvent, CompilerEventType, CompilerStateEvent } from './types.ts';

const VALID_EVENT_TYPES = new Set<CompilerEventType>(['change', 'log', 'progress', 'state', 'all']);

export class EventUtil {
  static isCompilerEventType = (value: string): value is CompilerEventType => VALID_EVENT_TYPES.has(value as CompilerEventType);

  static isCompilerEvent = (value: unknown): value is CompilerEvent =>
    isRecordWithStringKey(value, 'type') && EventUtil.isCompilerEventType(value.type);

  static hasProcessId(payload: CompilerStateEvent): payload is CompilerStateEvent & { extra: { processId: number } } {
    return typeof payload.extra?.processId === 'number';
  }

  static sendEvent<E extends CompilerEvent>(type: E['type'], payload: E['payload']): void {
    process.connected && process.send?.({ type, payload }, undefined, undefined, () => {});
  }
}
