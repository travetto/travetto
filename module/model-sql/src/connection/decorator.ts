import { MethodDescriptor } from '@travetto/base/src/internal/types';
import { Connection, TransactionType } from './base';

/**
 * Indicating something is aware of connections
 */
export interface ConnectionAware<C = unknown> {
  conn: Connection<C>;
}

/**
 * Decorator to ensure a method runs with a valid connection
 */
export function Connected<T extends ConnectionAware>() {
  return function (target: T, prop: string | symbol, desc: MethodDescriptor) {
    const og = desc.value!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    desc.value = async function (this: any, ...args: any[]) {
      return this.conn.runWithActive(() => og.call(this, ...args));
    };
  };
}

/**
 * Decorator to ensure a method runs with a valid connection
 */
export function ConnectedIterator<T extends ConnectionAware>() {
  return function (target: T, prop: string | symbol, desc: MethodDescriptor) {
    const og = desc.value!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    desc.value = async function* (this: any, ...args: any[]) {
      yield* this.conn.iterateWithActive(() => og.call(this, ...args));
    };
  };
}

/**
 * Decorator to ensure a method runs with a valid transaction
 */
export function Transactional<T extends ConnectionAware>(mode: TransactionType = 'required') {
  return function (target: T, prop: string | symbol, desc: MethodDescriptor) {
    const og = desc.value!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    desc.value = function (this: any, ...args: any[]) {
      return this.conn.runWithTransaction(mode, () => og.call(this, ...args));
    };
  };
}
