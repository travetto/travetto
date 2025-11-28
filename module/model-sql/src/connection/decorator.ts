import { AsyncItrMethodDescriptor, AsyncMethodDescriptor } from '@travetto/runtime';
import { Connection, TransactionType } from './base.ts';

/**
 * Indicating something is aware of connections
 */
export interface ConnectionAware<C = unknown> {
  conn: Connection<C>;
}

/**
 * Decorator to ensure a method runs with a valid connection
 * @kind decorator
 */
export function Connected() {
  return function <T extends { conn?: Connection }>(
    target: T, prop: string | symbol, desc: AsyncMethodDescriptor<T>
  ): void {
    const og = desc.value!;
    desc.value = function (...args: unknown[]): ReturnType<typeof og> {
      return this.conn!.runWithActive(() => og.call(this, ...args));
    };
  };
}

/**
 * Decorator to ensure a method runs with a valid connection
 * @kind decorator
 */
export function ConnectedIterator() {
  return function <T extends { conn?: Connection }>(
    target: T, prop: string | symbol, desc: AsyncItrMethodDescriptor<T>
  ): void {
    const og = desc.value!;
    desc.value = async function* (...args: unknown[]): ReturnType<typeof og> {
      yield* this.conn!.iterateWithActive(() => og.call(this, ...args));
    };
  };
}

/**
 * Decorator to ensure a method runs with a valid transaction
 * @kind decorator
 */
export function Transactional(mode: TransactionType = 'required') {
  return function <T extends { conn?: Connection }>(
    target: unknown, prop: string | symbol, desc: AsyncMethodDescriptor<T>
  ): void {
    const og = desc.value!;
    desc.value = function (...args: unknown[]): ReturnType<typeof og> {
      return this.conn!.runWithTransaction(mode, () => og.call(this, ...args));
    };
  };
}