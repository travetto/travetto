import { AsyncItrMethodDescriptor, AsyncMethodDescriptor } from '@travetto/runtime';
import { Connection, TransactionType } from './base.ts';

/**
 * Indicating something is aware of connections
 */
export interface ConnectionAware<C = unknown> {
  connection: Connection<C>;
}

/**
 * Decorator to ensure a method runs with a valid connection
 * @kind decorator
 */
export function Connected() {
  return function <T extends { connection?: Connection }>(
    target: T, property: string | symbol, descriptor: AsyncMethodDescriptor<T>
  ): void {
    const handle = descriptor.value!;
    descriptor.value = function (...args: unknown[]): ReturnType<typeof handle> {
      return this.connection!.runWithActive(() => handle.call(this, ...args));
    };
  };
}

/**
 * Decorator to ensure a method runs with a valid connection
 * @kind decorator
 */
export function ConnectedIterator() {
  return function <T extends { connection?: Connection }>(
    target: T, property: string | symbol, descriptor: AsyncItrMethodDescriptor<T>
  ): void {
    const handle = descriptor.value!;
    descriptor.value = async function* (...args: unknown[]): ReturnType<typeof handle> {
      yield* this.connection!.iterateWithActive(() => handle.call(this, ...args));
    };
  };
}

/**
 * Decorator to ensure a method runs with a valid transaction
 * @kind decorator
 */
export function Transactional(mode: TransactionType = 'required') {
  return function <T extends { connection?: Connection }>(
    target: unknown, property: string | symbol, descriptor: AsyncMethodDescriptor<T>
  ): void {
    const handle = descriptor.value!;
    descriptor.value = function (...args: unknown[]): ReturnType<typeof handle> {
      return this.connection!.runWithTransaction(mode, () => handle.call(this, ...args));
    };
  };
}