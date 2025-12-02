import { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

import { ShutdownManager, Util } from '@travetto/runtime';

/**
 * Channel that represents ipc communication
 */
export class IpcChannel<V = unknown> {

  #emitter = new EventEmitter();
  subProcess: NodeJS.Process | ChildProcess;
  parentId: number;

  constructor(subProcess: NodeJS.Process | ChildProcess = process) {
    this.subProcess = subProcess;
    this.parentId = subProcess instanceof ChildProcess ? process.pid : process.ppid;

    // Close on shutdown
    ShutdownManager.onGracefulShutdown(() => this.destroy());

    this.subProcess.on('message', (event: { type: string }) => {
      console.debug('Received', { pid: this.parentId, id: this.id, type: event.type });
      this.#emitter.emit(event.type, event);
      this.#emitter.emit('*', event);
    });
  }

  /**
   * Gets channel unique identifier
   */
  get id(): number | undefined {
    return this.subProcess.pid;
  }

  /**
   * Determines if channel is active
   */
  get active(): boolean {
    return (this.subProcess instanceof ChildProcess) ? !this.subProcess.killed : !!this.subProcess.connected;
  }

  /**
   * Send data to the parent
   */
  send(eventType: string, data?: Record<string, unknown>): void {
    console.debug('Sending', { pid: this.parentId, id: this.id, eventType });
    if (!this.active) {
      throw new Error('Cannot send message to inactive process');
    } else if (this.subProcess.send && this.subProcess.connected) {
      this.subProcess.send({ ...(data ?? {}), type: eventType }, undefined, undefined, (error) => error && console.error(error));
    } else {
      throw new Error('this.subProcess.send was not defined');
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
    return new Promise(resolve => this.#emitter.once(eventType, resolve));
  }

  /**
   * Destroy self
   */
  async destroy(): Promise<void> {
    if (this.active) {
      try {
        console.debug('Killing', { pid: this.parentId, id: this.id });
        if (this.subProcess instanceof ChildProcess) {
          const complete = new Promise<void>(resolve => this.subProcess.on('close', resolve));
          this.subProcess.kill();
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
    this.subProcess.removeAllListeners();
    this.#emitter.removeAllListeners();
  }
}