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
  return function (target: T, prop: string | symbol, desc: TypedPropertyDescriptor<(this: T, ...args: any[]) => Promise<any>>) {
    const og = desc.value!;
    desc.value = async function (this: T, ...args: any[]) {
      return this.conn.runWithActive(() => og.call(this, ...args));
    };
  };
}

/**
 * Decorator to ensure a method runs with a valid connection
 */
export function ConnectedIterator<T extends ConnectionAware>() {
  return function (target: T, prop: string | symbol, desc: TypedPropertyDescriptor<(this: T, ...args: any[]) => AsyncGenerator<any>>) {
    const og = desc.value!;
    desc.value = async function* (this: T, ...args: any[]) {
      yield* this.conn.iterateWithActive(() => og.call(this, ...args));
    };
  };
}

/**
 * Decorator to ensure a method runs with a valid transaction
 */
export function Transactional<T extends ConnectionAware>(mode: TransactionType = 'required') {
  return function (target: T, prop: string | symbol, desc: TypedPropertyDescriptor<(this: T, ...args: any[]) => Promise<any>>) {
    const og = desc.value!;
    desc.value = function (this: T, ...args: any[]) {
      return this.conn.runWithTransaction(mode, () => og.call(this, ...args));
    };
  };
}
