import { Env } from './env.ts';
import type { ClassInstance } from './types.ts';

/**
 * The `@DebugBreak` indicates that a function inserts an optional debugger keyword to stop on entry
 * @augments `@travetto/runtime:DebugBreak`
 */
export function DebugBreak(): MethodDecorator {
  return (instance: ClassInstance, property: string | symbol, descriptor: PropertyDescriptor) => descriptor;

}

/**
 * Determine if we should invoke the debugger
 */
export function tryDebugger(): boolean {
  return Env.TRV_DEBUG_BREAK.isTrue;
}