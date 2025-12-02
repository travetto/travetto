import { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

import { ShutdownManager, Util } from '@travetto/runtime';

/**
 * Channel that represents ipc communication
 */
export class IpcChannel<V = unknown> {

  #emitter = new EventEmitter();
  proc: NodeJS.Process | ChildProcess;
  parentId: number;

  constructor(proc: NodeJS.Process | ChildProcess = process) {
    this.proc = proc;
    this.parentId = proc instanceof ChildProcess ? process.pid : process.ppid;

    // Close on shutdown
    ShutdownManager.onGracefulShutdown(() => this.destroy());

    this.proc.on('message', (ev: { type: string }) => {
      console.debug('Received', { pid: this.parentId, id: this.id, type: ev.type });
      this.#emitter.emit(ev.type, ev);
      this.#emitter.emit('*', ev);
    });
  }

  /**
   * Gets channel unique identifier
   */
  get id(): number | undefined {
    return this.proc.pid;
  }

  /**
   * Determines if channel is active
   */
  get active(): boolean {
    return (this.proc instanceof ChildProcess) ? !this.proc.killed : !!this.proc.connected;
  }

  /**
   * Send data to the parent
   */
  send(eventType: string, data?: Record<string, unknown>): void {
    console.debug('Sending', { pid: this.parentId, id: this.id, eventType });
    if (!this.active) {
      throw new Error('Cannot send message to inactive process');
    } else if (this.proc.send && this.proc.connected) {
      this.proc.send({ ...(data ?? {}), type: eventType }, undefined, undefined, (err) => err && console.error(err));
    } else {
      throw new Error('this.proc.send was not defined');
    }
  }

  /**
   * Listen for a specific message type
   */
  on(eventType: string, callback: (event: V & { type: string }) => unknown | void): () => void {
    this.#emitter.on(eventType, callback);
    return () => this.off(eventType, callback);
  }

  /**
   * Remove event listener
   */
  off(eventType: string, callback: (event: V & { type: string }) => unknown | void): void {
    this.#emitter.off(eventType, callback);
  }

  /**
   * Listen for a specific message type, once
   */
  once(eventType: string): Promise<V & { type: string }> {
    return new Promise(res => this.#emitter.once(eventType, res));
  }

  /**
   * Destroy self
   */
  async destroy(): Promise<void> {
    if (this.active) {
      try {
        console.debug('Killing', { pid: this.parentId, id: this.id });
        if (this.proc instanceof ChildProcess) {
          const complete = new Promise<void>(r => this.proc.on('close', r));
          this.proc.kill();
          await Promise.race([complete, Util.nonBlockingTimeout(1000)]);
        }
      } catch { }
    }
    this.release();
  }

  /**
   * Remove all listeners, but do not destroy
   */
  release(): void {
    console.debug('Released', { pid: this.parentId, id: this.id });
    this.proc.removeAllListeners();
    this.#emitter.removeAllListeners();
  }
}