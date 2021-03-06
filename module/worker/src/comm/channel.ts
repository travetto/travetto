import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

import { ExecUtil } from '@travetto/boot';

/**
 * Channel that represents communication between parent/child
 */
export class ProcessCommChannel<T extends NodeJS.Process | ChildProcess, V = unknown, U extends { type: string } = V & { type: string }> {

  #proc: T | undefined;
  #emitter = new EventEmitter();

  constructor(proc: T) {
    this.#proc = proc;
    console.debug('Constructed Execution', { pid: this.id });
    this.#proc.on('message', this.#handleMessage.bind(this));
  }

  get #parentId() {
    return process.pid;
  }

  #handleMessage(ev: { type: string }) {
    console.debug('Received', { pid: this.#parentId, id: this.id, type: ev.type });
    this.#emitter.emit(ev.type, ev);
    this.#emitter.emit('*', ev);
  }

  get proc() {
    return this.#proc;
  }

  set proc(proc: T | undefined) {
    this.#proc = proc;
  }

  /**
   * Gets channel unique identifier
   */
  get id() {
    return this.#proc && this.#proc.pid;
  }

  /**
   * Determines if channel is active
   */
  get active() {
    return !!this.#proc;
  }

  /**
   * Send data to the parent
   */
  send(eventType: string, data?: Record<string, unknown>) {
    console.debug('Sending', { pid: this.#parentId, id: this.id, eventType });
    if (!this.#proc) {
      throw new Error('this.proc was not defined');
    } else if (this.#proc.send) {
      this.#proc.send({ ...(data ?? {}), type: eventType });
    } else {
      throw new Error('this.proc.send was not defined');
    }
  }

  /**
   * Listen for a specific message type
   */
  on(eventType: string, callback: (e: U) => unknown | void) {
    this.#emitter.on(eventType, callback);
    return () => this.off(eventType, callback);
  }

  /**
   * Remove event listener
   */
  off(eventType: string, callback: (e: U) => unknown | void) {
    this.#emitter.off(eventType, callback);
  }

  /**
   * Listen for a specific message type, once
   */
  once(eventType: string) {
    return new Promise<U>(res => this.#emitter.once(eventType, res));
  }

  /**
   * Destroy self
   */
  async destroy() {
    if (this.#proc) {
      console.debug('Killing', { pid: this.#parentId, id: this.id });
      if (this.#proc !== process) {
        ExecUtil.kill(this.#proc);
      }
      this.#proc = undefined;
    }
    this.release();
  }

  /**
   * Remove all listeners, but do not destroy
   */
  release() {
    console.debug('Released', { pid: this.#parentId, id: this.id });
    this.#emitter.removeAllListeners();
  }
}