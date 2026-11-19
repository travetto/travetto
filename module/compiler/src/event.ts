import type { CompilerEvent, CompilerEventType, CompilerStateEvent } from './types.ts';

const hasTypeField = (value: unknown): value is { type: string } => typeof value === 'object' && !!value && 'type' in value;

const VALID_EVENT_TYPES = new Set<CompilerEventType>(['change', 'log', 'progress', 'state', 'all']);

export class EventUtil {
  static isCompilerEventType = (value: unknown): value is CompilerEventType => VALID_EVENT_TYPES.has(value as CompilerEventType);

  static isCompilerEvent = (value: unknown): value is CompilerEvent => hasTypeField(value) && EventUtil.isCompilerEventType(value.type);

  static hasProcessId(payload: CompilerStateEvent): payload is CompilerStateEvent & { extra: { processId: number } } {
    return typeof payload.extra?.processId === 'number';
  }

  static sendEvent<E extends CompilerEvent>(type: E['type'], payload: E['payload']): void {
    process.connected && process.send?.({ type, payload }, undefined, undefined, () => {});
  }
}
